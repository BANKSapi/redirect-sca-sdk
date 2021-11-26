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
 */
function continueRedirect () {
    return returnNextRedirect().then(continueTo => {
        switch (continueTo) {
            case 'PROVIDER':
                return helper.continueToProvider(redirectSca.baseUrl, redirectSca.state);
            case 'CUSTOMER':
                return helper.continueToCustomer(redirectSca.baseUrl);
        }
    });
}

/**
 * Aborts the redirect SCA process. If possible the authentication will be aborted and
 * the user is being redirected to the tenant with an 'redirect-sca-error' query parameter.
 * Otherwise the promise will be rejected.
 *
 * @returns {Promise} rejected if no callback could be performed
 */
 function abortSca () {
    return helper.abortSca();
}

module.exports = {
    initState: initState,
    returnNextRedirect: returnNextRedirect,
    continueRedirect: continueRedirect,
    abortSca: abortSca
};