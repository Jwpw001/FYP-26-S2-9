const prisma = require("../config/prisma");

const getAttendanceReport = async (outletId, startDate, endDate) => {
  try {
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        shift_assignments: {
          shift_roles: {
            shifts: {
              outlet_id: parseInt(outletId),
              shift_date: {
                gte: new Date(startDate),
                lte: new Date(endDate)
              }
            }
          }
        }
      },
      include: {
        shift_assignments: {
          include: {
            shift_roles: {
              include: {
                shifts: {
                  include: {
                    outlets: {
                      select: {
                        outlet_id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            },
            staff: {
              include: {
                users: {
                  select: {
                    user_id: true,
                    full_name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        users: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        marked_at: "desc"
      }
    });

    // Calculate summary statistics
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(record => record.status === "present").length;
    const absentCount = attendanceRecords.filter(record => record.status === "absent").length;
    const lateCount = attendanceRecords.filter(record => record.status === "late").length;

    return {
      success: true,
      report: {
        outlet_id: parseInt(outletId),
        period: {
          start_date: startDate,
          end_date: endDate
        },
        summary: {
          total_records: totalRecords,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          attendance_rate: totalRecords > 0 ? ((presentCount + lateCount) / totalRecords * 100) : 0
        },
        details: attendanceRecords
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const getWorkloadReport = async (outletId, startDate, endDate) => {
  try {
    // Get shifts and their staffing levels
    const shifts = await prisma.shifts.findMany({
      where: {
        outlet_id: parseInt(outletId),
        shift_date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      include: {
        outlets: {
          select: {
            outlet_id: true,
            name: true
          }
        },
        shift_roles: {
          include: {
            skills: {
              select: {
                skill_id: true,
                name: true
              }
            }
          }
        },
        shift_assignments: {
          include: {
            staff: {
              include: {
                users: {
                  select: {
                    user_id: true,
                    full_name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        shift_date: "asc",
        start_time: "asc"
      }
    });

    // Calculate workload statistics
    const reportData = shifts.map(shift => {
      const totalRequired = shift.shift_roles.reduce((sum, role) => sum + role.headcount, 0);
      const totalAssigned = shift.shift_assignments.filter(a => a.status === "assigned" || a.status === "completed").length;
      const staffingPercentage = totalRequired > 0 ? (totalAssigned / totalRequired * 100) : 0;

      return {
        shift_id: shift.shift_id,
        title: shift.title,
        date: shift.shift_date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        outlet_name: shift.outlets.name,
        total_required_staff: totalRequired,
        total_assigned_staff: totalAssigned,
        staffing_percentage: parseFloat(staffingPercentage.toFixed(2)),
        shift_roles: shift.shift_roles.map(role => ({
          role_id: role.role_id,
          role_name: role.role_name,
          headcount: role.headcount,
          assigned_count: shift.shift_assignments.filter(a => a.role_id === role.role_id && (a.status === "assigned" || a.status === "completed")).length
        })),
        assignments: shift.shift_assignments.map(assignment => ({
          assignment_id: assignment.assignment_id,
          staff_id: assignment.staff_id,
          staff_name: assignment.staff ? assignment.staff.users.full_name : "Unassigned",
          status: assignment.status,
          acknowledged: assignment.acknowledged
        }))
      };
    });

    return {
      success: true,
      report: {
        outlet_id: parseInt(outletId),
        period: {
          start_date: startDate,
          end_date: endDate
        },
        shifts: reportData
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const getUnderstaffedReport = async (outletId, startDate, endDate) => {
  try {
    // Get shifts that are understaffed (less than 80% staffed)
    const shifts = await prisma.shifts.findMany({
      where: {
        outlet_id: parseInt(outletId),
        shift_date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      include: {
        outlets: {
          select: {
            outlet_id: true,
            name: true
          }
        },
        shift_roles: {
          include: {
            skills: {
              select: {
                skill_id: true,
                name: true
              }
            }
          }
        },
        shift_assignments: {
          include: {
            staff: {
              include: {
                users: {
                  select: {
                    user_id: true,
                    full_name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        shift_date: "asc",
        start_time: "asc"
      }
    });

    // Filter for understaffed shifts (< 80% staffed)
    const understaffedShifts = shifts.reduce((acc, shift) => {
      const totalRequired = shift.shift_roles.reduce((sum, role) => sum + role.headcount, 0);
      const totalAssigned = shift.shift_assignments.filter(a => a.status === "assigned" || a.status === "completed").length;
      const staffingPercentage = totalRequired > 0 ? (totalAssigned / totalRequired * 100) : 0;

      if (staffingPercentage < 80) {
        acc.push({
          shift_id: shift.shift_id,
          title: shift.title,
          date: shift.shift_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          outlet_name: shift.outlets.name,
          total_required_staff: totalRequired,
          total_assigned_staff: totalAssigned,
          staffing_percentage: parseFloat(staffingPercentage.toFixed(2)),
          shortage: totalRequired - totalAssigned,
          shift_roles: shift.shift_roles.map(role => ({
            role_id: role.role_id,
            role_name: role.role_name,
            headcount: role.headcount,
            assigned_count: shift.shift_assignments.filter(a => a.role_id === role.role_id && (a.status === "assigned" || a.status === "completed")).length,
            shortage: Math.max(0, role.headcount - shift.shift_assignments.filter(a => a.role_id === role.role_id && (a.status === "assigned" || a.status === "completed")).length)
          }))
        });
      }

      return acc;
    }, []);

    return {
      success: true,
      report: {
        outlet_id: parseInt(outletId),
        period: {
          start_date: startDate,
          end_date: endDate
        },
        understaffed_shifts: understaffedShifts,
        summary: {
          total_shifts_checked: shifts.length,
          understaffed_count: understaffedShifts.length
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

module.exports = {
  getAttendanceReport,
  getWorkloadReport,
  getUnderstaffedReport
};