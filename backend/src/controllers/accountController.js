const getAccount = (req, res) => {
    res.json({
        success: true,
        message: "Get account controller working"
    });
};

module.exports = {
    getAccount
};