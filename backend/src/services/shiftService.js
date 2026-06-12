const prisma = require("../config/prisma");

const getShiftsByOutlet = async (outletId) => {
  try {
    const shifts = await prisma.shifts.findMany({
      where: {
        outlet_id: parseInt(outletId)
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
                    full_name: true,
                    email: true
                  }
                }
              }
            },
            shift_roles: {
              select: {
                role_id: true,
                role_name: true
              }
            }
          }
        }
      },
      orderBy: {
        shift_date: "desc",
        start_time: "asc"
      }
    });

    return {
      success: true,
      shifts
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const getShiftById = async (shiftId) => {
  try {
    const shift = await prisma.shifts.findUnique({
      where: {
        shift_id: parseInt(shiftId)
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
                    full_name: true,
                    email: true
                  }
                }
              }
            },
            shift_roles: {
              select: {
                role_id: true,
                role_name: true
              }
            }
          }
        }
      }
    });

    if (!shift) {
      return {
        success: false,
        message: "Shift not found"
      };
    }

    return {
      success: true,
      shift
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const createShift = async (shiftData) => {
  try {
    const shift = await prisma.shifts.create({
      data: {
        outlet_id: shiftData.outlet_id,
        title: shiftData.title,
        shift_date: new Date(shiftData.shift_date),
        start_time: new Date(`1970-01-01T${shiftData.start_time}:00`),
        end_time: new Date(`1970-01-01T${shiftData.end_time}:00`),
        status: shiftData.status || "draft",
        created_by: shiftData.created_by
      },
      include: {
        outlets: {
          select: {
            outlet_id: true,
            name: true
          }
        }
      }
    });

    return {
      success: true,
      message: "Shift created successfully",
      shift
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const updateShift = async (shiftId, shiftData) => {
  try {
    const shift = await prisma.shifts.update({
      where: {
        shift_id: parseInt(shiftId)
      },
      data: {
        title: shiftData.title,
        shift_date: shiftData.shift_date ? new Date(shiftData.shift_date) : undefined,
        start_time: shiftData.start_time ? new Date(`1970-01-01T${shiftData.start_time}:00`) : undefined,
        end_time: shiftData.end_time ? new Date(`1970-01-01T${shiftData.end_time}:00`) : undefined,
        status: shiftData.status,
        created_by: shiftData.created_by
      },
      include: {
        outlets: {
          select: {
            outlet_id: true,
            name: true
          }
        }
      }
    });

    return {
      success: true,
      message: "Shift updated successfully",
      shift
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const deleteShift = async (shiftId) => {
  try {
    await prisma.shifts.delete({
      where: {
        shift_id: parseInt(shiftId)
      }
    });

    return {
      success: true,
      message: "Shift deleted successfully"
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

module.exports = {
  getShiftsByOutlet,
  getShiftById,
  createShift,
  updateShift,
  deleteShift
};