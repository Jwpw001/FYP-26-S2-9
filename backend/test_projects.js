const prisma = require('./src/config/prisma');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function test() {
  try {
    const s = await prisma.staff.findFirst({ where: { user_id: 204 }, select: { outlet_id: true } });
    console.log('staff record:', s);
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: outlet } = await sb.from('outlets').select('business_id').eq('outlet_id', s.outlet_id).maybeSingle();
    console.log('outlet:', outlet);
    const projects = await prisma.projects.findMany({
      where: { business_id: outlet.business_id },
      include: {
        project_assignments: { include: { staff: { include: { users: { select: { full_name: true } } } } } },
        timesheets: { select: { hours_worked: true, status: true } }
      }
    });
    console.log('projects count:', projects.length);
    console.log('project names:', projects.map(p => p.name));
  } catch(e) { console.error('ERROR:', e.message); }
  finally { await prisma.$disconnect(); }
}
test();
