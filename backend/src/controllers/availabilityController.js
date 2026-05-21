const getAvailability = (req, res) => {

    res.json({
        success: true,
        message: "Get all availability"
    });

};

const getAvailabilityById = (req, res) => {

    res.json({
        success: true,
        message: "Get availability by ID",
        availabilityId: req.params.id
    });

};

const createAvailability = (req, res) => {

    res.status(201).json({
        success: true,
        message: "Create availability",
        data: req.body
    });

};

const updateAvailability = (req, res) => {

    res.json({
        success: true,
        message: "Update availability",
        availabilityId: req.params.id,
        data: req.body
    });

};

const deleteAvailability = (req, res) => {

    res.json({
        success: true,
        message: "Delete availability",
        availabilityId: req.params.id
    });

};

module.exports = {
    getAvailability,
    getAvailabilityById,
    createAvailability,
    updateAvailability,
    deleteAvailability
};