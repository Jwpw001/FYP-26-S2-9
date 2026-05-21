const getAccount = (req, res) => {
    res.json({
        success: true,
        message: "Get account"
    });
};

const updateAccount = (req, res) => {
    res.json({
        success: true,
        message: "Update account",
        data: req.body
    });
};

const deleteAccount = (req, res) => {
    res.json({
        success: true,
        message: "Delete account"
    });
};

module.exports = {
    getAccount,
    updateAccount,
    deleteAccount
};