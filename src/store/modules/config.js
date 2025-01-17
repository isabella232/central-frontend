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

// This file contains configuration for Frontend. The configuration is stored in
// the Vuex store for ease of access and to facilitate testing. However, these
// properties are static: nothing in Frontend will change them.

const config = {
  // `true` to allow navigation to /system/backups and `false` not to.
  showsBackups: true,
  // `true` to allow navigation to /system/analytics and `false` not to.
  showsAnalytics: true
};

export default {
  state: { ...config },
  mutations: {
    resetConfig(state) {
      for (const [key, value] of Object.entries(config))
        state[key] = value;
    },
    setConfig(state, { key, value }) {
      state[key] = value;
    }
  }
};
