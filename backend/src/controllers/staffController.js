const getStaff = (req, res) => {

    res.json({
        success: true,
        message: "Get all staff"
    });

};

const createStaff = (req, res) => {

    res.status(201).json({
        success: true,
        message: "Create staff",
        data: req.body
    });

};

const updateStaff = (req, res) => {

    res.json({
        success: true,
        message: "Update staff",
        staffId: req.params.id,
        data: req.body
    });

};

const deleteStaff = (req, res) => {

    res.json({
        success: true,
        message: "Delete staff",
        staffId: req.params.id
    });

};

module.exports = {
    getStaff,
    createStaff,
    updateStaff,
    deleteStaff
};