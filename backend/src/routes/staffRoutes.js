const express = require("express");

const router = express.Router();

const {
    getStaff,
    createStaff,
    updateStaff,
    deleteStaff
} = require("../controllers/staffController");

const validate = require("../middleware/validateMiddleware");

const {
    createStaffSchema,
    updateStaffSchema
} = require("../validators/staffValidator");

router.get("/", getStaff);

router.post(
    "/",
    validate(createStaffSchema),
    createStaff
);

router.patch(
    "/:id",
    validate(updateStaffSchema),
    updateStaff
);

router.delete("/:id", deleteStaff);

module.exports = router;