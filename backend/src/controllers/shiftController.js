const getShifts = (req, res) => {

    res.json({
        success: true,
        message: "Get all shifts"
    });

};

const getShiftById = (req, res) => {

    res.json({
        success: true,
        message: "Get shift by ID",
        shiftId: req.params.id
    });

};

const createShift = (req, res) => {

    res.status(201).json({
        success: true,
        message: "Create shift",
        data: req.body
    });

};

const updateShift = (req, res) => {

    res.json({
        success: true,
        message: "Update shift",
        shiftId: req.params.id,
        data: req.body
    });

};

const deleteShift = (req, res) => {

    res.json({
        success: true,
        message: "Delete shift",
        shiftId: req.params.id
    });

};

module.exports = {
    getShifts,
    getShiftById,
    createShift,
    updateShift,
    deleteShift
};