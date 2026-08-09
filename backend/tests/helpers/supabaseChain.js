// Minimal chainable + thenable mock of the subset of the supabase-js query builder actually used
// by taskController.js / casualController.js (`.select().eq().maybeSingle()`, or awaiting the
// chain directly without a terminal call — supabase-js query builders are themselves thenable).
// Lets tests stub Supabase responses without a live database.
function makeSupabaseChain(result) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    order: jest.fn(() => chain),
    is: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

module.exports = { makeSupabaseChain };
