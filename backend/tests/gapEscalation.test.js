jest.mock("../src/config/prisma", () => ({
  shift_tasks: { findMany: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));
jest.mock("../src/utils/notify", () => ({
  notifyUsersBatched: jest.fn().mockResolvedValue(undefined),
  getBranchManagerUserIds: jest.fn(),
}));
// notificationJobs.js pulls in OpenAI + the AI brief-message builder at module load time for the
// (unrelated) suggestUnderstaffedShifts job — stub both so requiring the module under test never
// needs a real API key.
jest.mock("openai", () => jest.fn().mockImplementation(() => ({ chat: { completions: { create: jest.fn() } } })));
jest.mock("../src/services/aiAssistantService", () => ({ buildBriefMessages: jest.fn() }));

const { makeSupabaseChain } = require("./helpers/supabaseChain");
const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { notifyUsersBatched, getBranchManagerUserIds } = require("../src/utils/notify");
const { escalateUnfilledTasks } = require("../src/jobs/notificationJobs");

const BRANCH_A = 1, MANAGER_A = 501;
const BRANCH_B = 2, MANAGER_B = 502;
const OWNER_ID = 900;

function openTask(branchId) {
  return { shifts: { branch_id: branchId } };
}

// Round 6, Task 7b: escalation tiers at exactly 7 / 3 / 1 days out, on the existing 23:00 cron
// job. 7-day and 3-day only notify the branch's manager(s); 1-day also notifies the business
// owner. All three tiers query independently (each is its own "N days out" window), so a branch
// with gaps at more than one horizon in the same run still only sends its manager ONE
// notification (asserted below via notifyUsersBatched's call args).
describe("escalateUnfilledTasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("no unfilled tasks at any tier sends nothing", async () => {
    prisma.shift_tasks.findMany.mockResolvedValue([]);
    await escalateUnfilledTasks();
    expect(notifyUsersBatched).not.toHaveBeenCalled();
  });

  test("a gap exactly 7 days out notifies only the branch manager (informational tier)", async () => {
    prisma.shift_tasks.findMany.mockImplementation(({ where }) => {
      const days = Math.round((where.shifts.shift_date.gte - new Date(new Date().setUTCHours(0, 0, 0, 0))) / 86400000);
      return Promise.resolve(days === 7 ? [openTask(BRANCH_A), openTask(BRANCH_A)] : []);
    });
    getBranchManagerUserIds.mockResolvedValue([MANAGER_A]);

    await escalateUnfilledTasks();

    expect(notifyUsersBatched).toHaveBeenCalledTimes(1);
    const entries = notifyUsersBatched.mock.calls[0][0];
    expect(entries).toHaveLength(1);
    expect(entries[0].recipientId).toBe(MANAGER_A);
    expect(entries[0].title).toMatch(/2 unfilled tasks in a week/);
    expect(entries[0].relatedEntity).toBe("shift_gaps");
    // Informational tier never touches the owner lookup.
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  test("a gap exactly 3 days out uses warning wording and still only notifies the manager", async () => {
    prisma.shift_tasks.findMany.mockImplementation(({ where }) => {
      const days = Math.round((where.shifts.shift_date.gte - new Date(new Date().setUTCHours(0, 0, 0, 0))) / 86400000);
      return Promise.resolve(days === 3 ? [openTask(BRANCH_A)] : []);
    });
    getBranchManagerUserIds.mockResolvedValue([MANAGER_A]);

    await escalateUnfilledTasks();

    const entries = notifyUsersBatched.mock.calls[0][0];
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toMatch(/1 unfilled task in 3 days/);
  });

  test("a gap exactly 1 day out is urgent and notifies both the manager and the business owner", async () => {
    prisma.shift_tasks.findMany.mockImplementation(({ where }) => {
      const days = Math.round((where.shifts.shift_date.gte - new Date(new Date().setUTCHours(0, 0, 0, 0))) / 86400000);
      return Promise.resolve(days === 1 ? [openTask(BRANCH_A)] : []);
    });
    getBranchManagerUserIds.mockResolvedValue([MANAGER_A]);
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "branches") return makeSupabaseChain({ data: { business_id: 55 }, error: null });
      if (table === "businesses") return makeSupabaseChain({ data: { owner_id: OWNER_ID }, error: null });
      return makeSupabaseChain({ data: null, error: null });
    });

    await escalateUnfilledTasks();

    const entries = notifyUsersBatched.mock.calls[0][0];
    const recipientIds = entries.map(e => e.recipientId).sort();
    expect(recipientIds).toEqual([MANAGER_A, OWNER_ID].sort());
    expect(entries.find(e => e.recipientId === MANAGER_A).title).toMatch(/Urgent: 1 unfilled task tomorrow/);
    expect(entries.find(e => e.recipientId === OWNER_ID).title).toMatch(/Urgent: 1 unfilled task tomorrow/);
  });

  test("a manager with gaps at two different tiers still gets exactly one notification", async () => {
    prisma.shift_tasks.findMany.mockImplementation(({ where }) => {
      const days = Math.round((where.shifts.shift_date.gte - new Date(new Date().setUTCHours(0, 0, 0, 0))) / 86400000);
      if (days === 7) return Promise.resolve([openTask(BRANCH_A)]);
      if (days === 1) return Promise.resolve([openTask(BRANCH_A)]);
      return Promise.resolve([]);
    });
    getBranchManagerUserIds.mockResolvedValue([MANAGER_A]);
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "branches") return makeSupabaseChain({ data: { business_id: 55 }, error: null });
      if (table === "businesses") return makeSupabaseChain({ data: { owner_id: OWNER_ID }, error: null });
      return makeSupabaseChain({ data: null, error: null });
    });

    await escalateUnfilledTasks();

    const entries = notifyUsersBatched.mock.calls[0][0];
    const forManagerA = entries.filter(e => e.recipientId === MANAGER_A);
    expect(forManagerA).toHaveLength(1); // collapsed into one row, not two separate notifications
    // Both tiers' dates end up concatenated into the single collapsed message.
    const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const oneDayOut = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(forManagerA[0].message).toContain(sevenDaysOut);
    expect(forManagerA[0].message).toContain(oneDayOut);
  });

  test("gaps in different branches notify each branch's own manager separately", async () => {
    prisma.shift_tasks.findMany.mockImplementation(({ where }) => {
      const days = Math.round((where.shifts.shift_date.gte - new Date(new Date().setUTCHours(0, 0, 0, 0))) / 86400000);
      return Promise.resolve(days === 7 ? [openTask(BRANCH_A), openTask(BRANCH_B)] : []);
    });
    getBranchManagerUserIds.mockImplementation((branchId) =>
      Promise.resolve(branchId === BRANCH_A ? [MANAGER_A] : [MANAGER_B])
    );

    await escalateUnfilledTasks();

    const entries = notifyUsersBatched.mock.calls[0][0];
    const recipientIds = entries.map(e => e.recipientId).sort();
    expect(recipientIds).toEqual([MANAGER_A, MANAGER_B].sort());
  });
});
