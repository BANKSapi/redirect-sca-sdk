const QUERY_PARAM_REDIRECT_SCA_ERROR = 'redirect-sca-error';

function initState() {
    const urlParams = new URLSearchParams(window.location.search);

    const callbackUrl = urlParams.get('callbackUrl');
    const forwardUrl = urlParams.get('forwardUrl');
    const sessionUrl = urlParams.get('sessionUrl');

    const queryParamsFilled = callbackUrl && forwardUrl && sessionUrl;
    if (queryParamsFilled) {
        clearStorage();
    }

    if (isSessionStorageFilled()) {
        clearStateIfTooOld();
    }

    const sessionStorageFilled = isSessionStorageFilled();
    return new Promise((resolve, reject) => {
        if (!sessionStorageFilled && !queryParamsFilled) {
            reject(new Error('state could not be initialized'));
        } else if (!sessionStorageFilled) {
            if (!callbackUrl) {
                reject(new Error('missing callbackUrl parameter'));
            } else if (!forwardUrl) {
                reject(new Error('missing forwardUrl parameter'));
            } else if (!sessionUrl) {
                reject(new Error('missing sessionUrl parameter'));
            }
        }
        resolve({
            callbackUrl: callbackUrl,
            forwardUrl: forwardUrl,
            sessionUrl: sessionUrl,
            sessionStorageFilled: sessionStorageFilled,
        });
    });
}

function continueToProvider(state) {
    if (!state ||
        !state.sessionUrl ||
        !state.forwardUrl ||
        !state.callbackUrl) {
        return Promise.reject(new Error('state not initialized'));
    }

    // get_session -> confirm_redirect -> redirect to provider
    return fetch(state.sessionUrl)
        .then(response => {
            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status} can not be handled`);
            }
            return response;
        })
        .then(response => response.json())
        .then(response => {
            const userToken = response.userToken;
            const correlationId = response.correlationId;
            const confirmRedirectUrl = response.confirmRedirectUrl;
            const authenticateRedirectUrl = response.authenticateRedirectUrl;

            if (!confirmRedirectUrl) {
                throw new Error('could not find confirmRedirectUrl');
            }

            if (!authenticateRedirectUrl) {
                throw new Error('could not find authenticateRedirectUrl');
            }

            sessionStorage.setItem('sca:confirmRedirectUrl', confirmRedirectUrl);
            sessionStorage.setItem('sca:authenticateRedirectUrl', authenticateRedirectUrl);
            sessionStorage.setItem('sca:callbackUrl', state.callbackUrl);
            sessionStorage.setItem('sca:userToken', userToken);
            sessionStorage.setItem('sca:correlationId', correlationId);
            sessionStorage.setItem('sca:time', new Date().toISOString());

            return confirmRedirect(userToken, confirmRedirectUrl, correlationId)
                .then(() => {
                    window.location.replace(state.forwardUrl);
                    return state.forwardUrl;
                });
        });
}

function continueToCustomer(redirectFn = defaultRedirectToCustomerFn) {
    let callbackUrl = sessionStorage.getItem('sca:callbackUrl');
    let userToken = sessionStorage.getItem('sca:userToken');
    let authenticateRedirectUrl = sessionStorage.getItem('sca:authenticateRedirectUrl');
    let correlationId = sessionStorage.getItem('sca:correlationId');
    let redirectScaError = evaluateUrlForErrors(window.location.href);

    return authenticate(userToken, authenticateRedirectUrl, correlationId)
        .then(() => {
            clearStorage();
            return redirectFn(callbackUrl, { redirectScaError });
        });
}

function defaultRedirectToCustomerFn(callbackUrl, { redirectScaError }) {
    if (redirectScaError) {
        let url = new URL(callbackUrl);
        url.searchParams.set(QUERY_PARAM_REDIRECT_SCA_ERROR, redirectScaError);
        callbackUrl = url.toString();
    }

    window.location.replace(callbackUrl);
    return callbackUrl;
}

function confirmRedirect(userToken, confirmRedirectUrl, correlationId) {
    return fetch(confirmRedirectUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
            'x-correlation-id': correlationId
        },
        body: null,
    }).then(response => {
        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status} can not be handled`);
        }
        return response;
    });
}

function authenticate(userToken, authenticateRedirectUrl, correlationId) {
    let payload = window.location.search;
    return fetch(authenticateRedirectUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
            'x-correlation-id': correlationId
        },
        body: payload ?
            JSON.stringify({
                'scaAuthenticationData': payload
            }) : JSON.stringify({}),
    }).then(response => {
        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status} can not be handled`);
        }
        return response;
    });
}

function abortSca() {
    if (isSessionStorageFilled()) {
        let callbackUrl = sessionStorage.getItem('sca:callbackUrl');
        let userToken = sessionStorage.getItem('sca:userToken');
        let correlationId = sessionStorage.getItem('sca:correlationId');
        let authenticateRedirectUrl = sessionStorage.getItem('sca:authenticateRedirectUrl');
        return authenticate(userToken, authenticateRedirectUrl, correlationId)
            .finally(() => {
                clearStorage();
                let url = new URL(callbackUrl);
                url.searchParams.set(QUERY_PARAM_REDIRECT_SCA_ERROR, 'user abort');
                window.location.replace(url);
            });
    } else {
        return Promise.reject(new Error('callback not found'));
    }
}

function isSessionStorageFilled() {
    return !!(sessionStorage.getItem('sca:callbackUrl') &&
        sessionStorage.getItem('sca:userToken') &&
        sessionStorage.getItem('sca:correlationId') &&
        sessionStorage.getItem('sca:time') &&
        sessionStorage.getItem('sca:confirmRedirectUrl') &&
        sessionStorage.getItem('sca:authenticateRedirectUrl'));
}

function evaluateUrlForErrors(urlString) {
    let url = new URL(urlString);
    let errorValue;
    if (url.searchParams.has('error_uri')) {
        errorValue = 'Fehler bei Kundenauthentifizierung';
    } else if (url.searchParams.has('error')) {
        errorValue = url.searchParams.get('error');
    } else if (url.searchParams.has('error_description')) {
        errorValue = url.searchParams.get('error_description');
    }
    return errorValue;
}

function clearStateIfTooOld() {
    let startTime = new Date(sessionStorage.getItem('sca:time'));
    let endTime = new Date();
    let difference = Math.abs(endTime.getTime() - startTime.getTime());
    let minutes = Math.round(difference / 60000);
    if (minutes > 15) {
        clearStorage();
    }
}

function clearStorage() {
    Object.keys(sessionStorage)
        .filter(key => key.startsWith('sca:'))
        .forEach(key => sessionStorage.removeItem(key));
}

module.exports = {
    initState,
    continueToProvider,
    continueToCustomer,
    confirmRedirect,
    authenticate,
    abortSca
};