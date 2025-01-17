/*
Copyright 2021 ODK Central Developers
See the NOTICE file at the top-level directory of this distribution and at
https://github.com/getodk/central-frontend/blob/master/NOTICE.

This file is part of ODK Central. It is subject to the license terms in
the LICENSE file found in the top-level directory of this distribution and at
https://www.apache.org/licenses/LICENSE-2.0. No part of ODK Central,
including this file, may be copied, modified, propagated, or distributed
except according to the terms contained in the LICENSE file.
*/

/*
To log in, the user submits the login form. Backend responds with a session
object, as well as an associated cookie that is Secure and HttpOnly. If the user
then opens Frontend in a new tab, Frontend will use the cookie to restore the
session.

The cookie is used in only limited ways: mostly Frontend specifies the session
token as a bearer token. The cookie is used to restore the session. It is also
used for non-AJAX requests, including download links and iframe forms. When the
user logs out, the cookie is removed.

Across tabs, Frontend allows only one user to be logged in at a time. (Otherwise
one user would use another user's cookie.) Further, Frontend allows only one
session to be in use at a time. We use local storage to enforce this,
coordinating login and logout across tabs:

  - If the user has the login page open in two tabs, logs in in one tab, then
    tries to log in in the other, the second login will fail, because the cookie
    will be sent without a CSRF token and without other auth. Because the cookie
    is HttpOnly, Frontend cannot check for the cookie directly. Instead, when
    the user logs in, Frontend stores the session expiration date in local
    storage, then checks it before another login attempt.
  - If the user logs out in one tab, Frontend removes the session expiration
    date from local storage, triggering other tabs to log out.

We considered allowing a user to create multiple sessions. However, this would
make logout difficult. For example, if the user logs in in one tab, creating one
session, then logs in in a second tab, creating another, it will be the second
tab that is associated with the cookie. Further, Backend will only allow the
second tab to remove the cookie. But that becomes a problem if the user closes
the second tab, then logs out in the first tab.

In summary, there is a single session, it has an associated cookie, and its
expiration date is also stored in local storage. This approach is designed to:

  - Support cookie auth
  - Ensure the user knows when they are logged out; prevent the user from seeing
    401 messages after their session has been deleted
  - Prevent one user from using another user's cookie
  - Ensure that the cookie is removed when the user logs out

If the user clears the cookie, then functionality that relies on it will stop
working. Chrome allows the user to clear cookies and local storage separately.
If the user clears local storage, it will trigger Frontend to log out in Chrome.
However, it will not in Firefox or Safari. Yet Frontend will still be able to
coordinate logout across tabs, enforcing a single session.

Similarly, if cookies are blocked, then functionality that relies on the cookie
will not work. If local storage is blocked, the user will be able to create
multiple sessions, and logout will not be coordinated across tabs. In Chrome,
Firefox, and Safari, blocking cookies and blocking local storage seem to go
hand-in-hand.
*/

import Vue from 'vue';

import i18n from '../i18n';
import { apiPaths, isProblem, requestAlertMessage } from './request';
import { forceReplace } from './router';
import { localStore } from './storage';
import { noop } from './util';

const removeSessionFromStorage = () => {
  /*
  If the user clears local storage, that will trigger a storage event in Chrome.
  However, it will not in Firefox or Safari. Yet even in that case, we want to
  ensure that logging out in one tab will trigger other tabs to log out. To do
  so, we set sessionExpires before removing it, ensuring a storage event (and
  actually probably two).

  Another tab may have already removed sessionExpires by logging out. In that
  case, setting and removing sessionExpires here will trigger a storage event in
  the other tab, though that should have no effect.
  */
  localStore.setItem('sessionExpires', '0');
  localStore.removeItem('sessionExpires');
};

const requestLogout = (store) => {
  const { token } = store.state.request.data.session;
  return Vue.prototype.$http.delete(apiPaths.session(token), {
    headers: { Authorization: `Bearer ${token}` }
  })
    .catch(error => {
      // logOutBeforeSessionExpires() and logOutAfterStorageChange() may try to
      // log out a session that has already been logged out. That will result in
      // a 401.2 or a 403.1, which we ignore.
      const { response } = error;
      if (response != null && isProblem(response.data) &&
        (response.data.code === 401.2 || response.data.code === 403.1)) {
        return;
      }

      store.commit('setAlert', {
        type: 'danger',
        message: i18n.t('util.session.alert.logoutError', {
          message: requestAlertMessage(error)
        })
      });
      throw error;
    });
};

export const logOut = (router, store, setNext) => {
  removeSessionFromStorage();
  const { expiresAt } = store.state.request.data.session;
  // If the session has expired (for example, while the computer was asleep), we
  // do not send a request, which would result in an error. (Using Date.parse()
  // rather than DateTime.fromISO() in order to reduce the bundle.)
  const promise = Date.parse(expiresAt) > Date.now()
    ? requestLogout(store)
    : Promise.resolve();
  // We clear all data and cancel any requests. However, that isn't ideal for
  // centralVersion, and we may need to revisit this logic in the future.
  store.commit('clearData');
  // Below, we navigate to /login. That alone would cancel many requests.
  // However, we also need to cancel requests for data that does not change with
  // navigation. There are also some cases in which we don't navigate to /login.
  store.commit('cancelRequests');

  // We do not navigate to /login for a logout during login or during the
  // initial navigation. After the initial navigation, navigation is
  // synchronous, so a logout during navigation is not possible.
  if (store.state.router.anyNavigationConfirmed &&
    router.currentRoute.path !== '/login') {
    const location = { path: '/login' };
    if (setNext) location.query = { next: router.currentRoute.fullPath };
    forceReplace(router, store, location);
  }

  return promise;
};

// We check for upcoming session expiration on an interval. We take that
// approach rather than using setTimeout() to schedule logout, because
// setTimeout() does not seem to clock time while the computer is asleep.
const logOutBeforeSessionExpires = (router, store) => {
  let alerted;
  return () => {
    const { session } = store.state.request.data;
    if (session == null) return;
    const millisUntilExpires = Date.parse(session.expiresAt) - Date.now();
    const millisUntilLogout = millisUntilExpires - 60000;
    if (millisUntilLogout <= 0) {
      logOut(router, store, true)
        .then(() => {
          store.commit('setAlert', {
            type: 'info',
            message: i18n.t('util.session.alert.expired')
          });
        })
        .catch(noop);
    } else if (alerted !== session.token) {
      // The alert also mentions this number. The alert will be a little
      // misleading if millisUntilAlert is markedly less than zero, but that
      // case is unlikely.
      const millisUntilAlert = millisUntilLogout - 120000;
      if (millisUntilAlert <= 0) {
        store.commit('setAlert', {
          type: 'info',
          message: i18n.t('util.session.alert.expiresSoon')
        });
        alerted = session.token;
      }
    }
  };
};

const logOutAfterStorageChange = (router, store) => (event) => {
  // event.key == null if the user clears local storage in Chrome.
  if ((event.key == null || event.key === 'sessionExpires') &&
    store.state.request.data.session != null) {
    logOut(router, store, true).catch(noop);
  }
};

export const useSessions = (router, store) => {
  const id = setInterval(logOutBeforeSessionExpires(router, store), 15000);
  const handler = logOutAfterStorageChange(router, store);
  window.addEventListener('storage', handler);
  return () => {
    clearInterval(id);
    window.removeEventListener('storage', handler);
  };
};

export const restoreSession = (store) => {
  const sessionExpires = localStore.getItem('sessionExpires');
  // We send a request if sessionExpires == null, partly in case there was a
  // logout error.
  if (sessionExpires != null && parseInt(sessionExpires, 10) <= Date.now())
    return Promise.reject();
  // There is a chance that the user's session will be restored almost
  // immediately before the session expires, such that the session expires
  // before logOutBeforeSessionExpires() logs out the user. However, that case
  // is unlikely, and the worst case should be that the user sees 401 messages.
  return store.dispatch('get', [{
    key: 'session',
    url: '/v1/sessions/restore',
    alert: false
  }])
    .catch(error => {
      // The user's session may be removed without the user logging out, for
      // example, if a backup is restored. In that case, the request will result
      // in a 404. sessionExpires may need to be removed from local storage in
      // order for the user to log in again.
      if (sessionExpires != null) {
        const { response } = error;
        if (response != null && isProblem(response.data) &&
          response.data.code === 404.1) {
          removeSessionFromStorage();
        }
      }

      throw error;
    });
};

/* The session must be set in the store before logIn() is called, meaning that
logIn() will be preceded by either the request to restore the session or a
request to create a session. We do not watch for a logout during either request.
However, if there is a logout during the request to restore the session, then
the request for the current user should result in an error. If there is a logout
during a request to create a session, then the new session will be used. */
export const logIn = (router, store, newSession) => {
  if (newSession) {
    /* If two tabs submit the login form at the same time, then both will end up
    logged out: the first tab to log in will set sessionExpires; then the second
    tab will set sessionExpires, logging out the first tab; which will remove
    sessionExpires, logging out the second tab. That will be true even in the
    (very unlikely) case that the two sessions have the same expiration date,
    because sessionExpires is removed before it is set. */
    localStore.removeItem('sessionExpires');
    const { expiresAt } = store.state.request.data.session;
    localStore.setItem('sessionExpires', Date.parse(expiresAt).toString());
  }

  return store.dispatch('get', [{
    key: 'currentUser',
    url: '/v1/users/current',
    extended: true
  }])
    .catch(error => {
      // If there is a logout while the request for the current user is in
      // progress, then the request will be canceled. This callback will then be
      // run, in which case we simply re-throw the error.
      if (store.state.request.data.session == null) throw error;

      return logOut(router, store, false)
        .then(() => {
          throw error;
        });
    })
    .then(() => {
      if (store.state.config.showsAnalytics &&
        store.state.request.data.currentUser.can('config.read')) {
        store.dispatch('get', [{
          key: 'analyticsConfig',
          url: '/v1/config/analytics',
          fulfillProblem: ({ code }) => code === 404.1,
          alert: false
        }]).catch(noop);
      }
    });
};
