const helper = require('./redirect-sca-helper.js');

const redirectSca = {};

/**
 * Initializes the state by reading the query parameters or the sessionStorage
 * respectively. It needs to be called before any other method. 
 * Pollutes the sessionStorage namespace beginning with "sca:".
 * @param {String} baseUrl can either be https://test.banksapi.io or https://banksapi.io
 * @returns {Promise} returns resolved promise as soon as application state has been initialized
 */
function initState (baseUrl) {
    return helper.initState(baseUrl).then(state => {
        redirectSca.state = state;
        redirectSca.baseUrl = baseUrl;
        return Promise.resolve();
    }).catch(error => Promise.reject(error));
}

/**
 * optional helper method, that returns the direction of the next redirection. No side effects.
 * @returns {Promise<String>} indicating next direction for redirect, can either be "PROVIDER"
 * or "CUSTOMER"
 */
function returnNextRedirect () {
    if (!redirectSca.state ||
        typeof redirectSca.state.sessionStorageFilled === 'boolean') {
        return Promise.reject(new Error('state not initialized'));
    }

    if (!redirectSca.state.sessionStorageFilled) {
        return Promise.resolve('PROVIDER');
    } else {
        return Promise.resolve('CUSTOMER');
    }
}

/**
 * Continues with the redirect by modifying the value of window.location
 * 
 * @returns {Promise} resolved promise
 */
function continueRedirect () {
    returnNextRedirect().then(continueTo => {
        switch (continueTo) {
            case 'PROVIDER':
                return helper.continueToProvider(redirectSca.baseUrl, redirectSca.state);
            case 'CUSTOMER':
                return helper.continueToCustomer(redirectSca.baseUrl);
        }
    })
}

module.exports = {
    initState: initState,
    returnNextRedirect: returnNextRedirect,
    continueRedirect: continueRedirect
};