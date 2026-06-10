const prisma = require("../config/prisma");

const getStaffByOutlet = async (outletId) => {
  try {
    const staff = await prisma.staff.findMany({
      where: {
        outlet_id: parseInt(outletId),
        is_active: true
      },
      include: {
        users: {
          select: {
            user_id: true,
            username: true,
            email: true,
            role: true,
            full_name: true,
            is_active: true
          }
        }
      },
      orderBy: {
        staff_id: "asc"
      }
    });

    return {
      success: true,
      staff
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const getStaffById = async (staffId) => {
  try {
    const staff = await prisma.staff.findUnique({
      where: {
        staff_id: parseInt(staffId)
      },
      include: {
        users: {
          select: {
            user_id: true,
            username: true,
            email: true,
            role: true,
            full_name: true,
            is_active: true
          }
        },
        outlets: {
          select: {
            outlet_id: true,
            name: true
          }
        }
      }
    });

    if (!staff) {
      return {
        success: false,
        message: "Staff not found"
      };
    }

    return {
      success: true,
      staff
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const createStaff = async (staffData) => {
  try {
    const staff = await prisma.staff.create({
      data: {
        user_id: staffData.user_id,
        outlet_id: staffData.outlet_id,
        staff_type: staffData.staff_type,
        default_work_days: staffData.default_work_days,
        hired_at: staffData.hired_at ? new Date(staffData.hired_at) : undefined,
        is_active: staffData.is_active !== undefined ? staffData.is_active : true
      },
      include: {
        users: {
          select: {
            user_id: true,
            username: true,
            email: true,
            role: true,
            full_name: true,
            is_active: true
          }
        },
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
      message: "Staff created successfully",
      staff
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const updateStaff = async (staffId, staffData) => {
  try {
    const staff = await prisma.staff.update({
      where: {
        staff_id: parseInt(staffId)
      },
      data: {
        user_id: staffData.user_id,
        outlet_id: staffData.outlet_id,
        staff_type: staffData.staff_type,
        default_work_days: staffData.default_work_days,
        hired_at: staffData.hired_at ? new Date(staffData.hired_at) : undefined,
        is_active: staffData.is_active
      },
      include: {
        users: {
          select: {
            user_id: true,
            username: true,
            email: true,
            role: true,
            full_name: true,
            is_active: true
          }
        },
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
      message: "Staff updated successfully",
      staff
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const deleteStaff = async (staffId) => {
  try {
    await prisma.staff.delete({
      where: {
        staff_id: parseInt(staffId)
      }
    });

    return {
      success: true,
      message: "Staff deleted successfully"
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

module.exports = {
  getStaffByOutlet,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff
};