/*
Copyright 2022 ODK Central Developers
See the NOTICE file at the top-level directory of this distribution and at
https://github.com/getodk/central-frontend/blob/master/NOTICE.

This file is part of ODK Central. It is subject to the license terms in
the LICENSE file found in the top-level directory of this distribution and at
https://www.apache.org/licenses/LICENSE-2.0. No part of ODK Central,
including this file, may be copied, modified, propagated, or distributed
except according to the terms contained in the LICENSE file.
*/
import createAlert from './alert';
import createCentralRouter from './router';
import i18n from './i18n';
import staticConfigFile from '../config';
import store from './store';

export default ({
  // `router` can be an object, or it can be a function that takes a partial
  // container and returns an object. It is also possible to create a container
  // without a router by specifying `null`.
  router = createCentralRouter,
  alert = createAlert(),
  staticConfig = staticConfigFile,
} = {}) => {
  const container = {
    i18n: i18n.global,
    store,
    alert,
    staticConfig,
  };
  if (router != null)
    container.router = typeof router === 'function' ? router(container) : router;
  container.install = (app) => {
    app
      .use(i18n)
      .use(store)
      .use(container.router)
      .provide('container', container)
      .provide('alert', alert)
      .provide('staticConfig', staticConfig)
  };
  return container;
};