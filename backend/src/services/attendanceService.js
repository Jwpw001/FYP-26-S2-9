const prisma = require("../config/prisma");

const getAttendanceByOutlet = async (outletId) => {
  try {
    const attendance = await prisma.attendance.findMany({
      where: {
        shift_assignments: {
          shift_roles: {
            shifts: {
              outlet_id: parseInt(outletId)
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

    return {
      success: true,
      attendance
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const markAttendance = async (attendanceData) => {
  try {
    const attendance = await prisma.attendance.create({
      data: {
        assignment_id: attendanceData.assignment_id,
        status: attendanceData.status,
        marked_by: attendanceData.marked_by,
        marked_at: attendanceData.marked_at ? new Date(attendanceData.marked_at) : new Date()
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
      }
    });

    return {
      success: true,
      message: "Attendance marked successfully",
      attendance
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

module.exports = {
  getAttendanceByOutlet,
  markAttendance
};