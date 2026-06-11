const prisma = require("../config/prisma");

const getAvailabilityByOutlet = async (outletId) => {
  try {
    const availability = await prisma.availability.findMany({
      where: {
        staff: {
          outlet_id: parseInt(outletId)
        }
      },
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
        start_date: "desc"
      }
    });

    return {
      success: true,
      availability
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const getAvailabilityByStaff = async (staffId) => {
  try {
    const availability = await prisma.availability.findMany({
      where: {
        staff_id: parseInt(staffId)
      },
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
        start_date: "desc"
      }
    });

    return {
      success: true,
      availability
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const createAvailability = async (availabilityData) => {
  try {
    const availability = await prisma.availability.create({
      data: {
        staff_id: availabilityData.staff_id,
        leave_type: availabilityData.leave_type,
        start_date: new Date(availabilityData.start_date),
        end_date: new Date(availabilityData.end_date),
        reason: availabilityData.reason,
        status: availabilityData.status || "pending",
        reviewed_by: availabilityData.reviewed_by,
        reviewed_at: availabilityData.reviewed_at ? new Date(availabilityData.reviewed_at) : null
      },
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
      message: "Availability request created successfully",
      availability
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const updateAvailabilityStatus = async (requestId, statusData) => {
  try {
    const availability = await prisma.availability.update({
      where: {
        request_id: parseInt(requestId)
      },
      data: {
        status: statusData.status,
        reviewed_by: statusData.reviewed_by,
        reviewed_at: statusData.reviewed_at ? new Date(statusData.reviewed_at) : new Date()
      },
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
      message: "Availability request status updated successfully",
      availability
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

module.exports = {
  getAvailabilityByOutlet,
  getAvailabilityByStaff,
  createAvailability,
  updateAvailabilityStatus
};