/**
 * Created by kep1u13 on 21/04/2016.
 */

"use strict";

var secrets = require('../config/secrets');

module.exports = tokenAuth;

function tokenAuth(req, res, next) {

    if (req.header(secrets.auth.token) !== secrets.auth.value) {
        console.log('Bad Token');
        res.status(403).json({'Error' : 'Permission denied'});
        return;
    }

    console.log('Token OK');
    next();
}