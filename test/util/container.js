import createContainer from '../../src/container';
import { noop } from '../../src/util/util';

import { setData } from './store';

export default (options = undefined) => {
  const fullOptions = {
    router: null,
    ...options
  };
  if (options.requestData != null) setData(options.requestData);
  const container = createContainer(fullOptions);

  const { install } = container;
  container.install = (app) => {
    install.call(container, app);
    // eslint-disable-next-line no-param-reassign
    app.config.globalProperties.$container = container;
  };

  return container;
};