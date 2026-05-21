const { getAccountService } = require("../services/accountService");

const getAccount = (req, res) => {

    const result = getAccountService();

    res.json(result);

};

module.exports = {
    getAccount
};