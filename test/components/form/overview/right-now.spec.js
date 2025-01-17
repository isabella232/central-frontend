import { RouterLinkStub } from '@vue/test-utils';

import FormOverviewRightNow from '../../../../src/components/form/overview/right-now.vue';
import FormVersionString from '../../../../src/components/form-version/string.vue';
import FormVersionViewXml from '../../../../src/components/form-version/view-xml.vue';
import SummaryItem from '../../../../src/components/summary-item.vue';

import testData from '../../../data';
import { load } from '../../../util/http';
import { mockLogin } from '../../../util/session';
import { mount } from '../../../util/lifecycle';

const mountComponent = () => {
  const form = testData.extendedForms.last();
  return mount(FormOverviewRightNow, {
    requestData: { form },
    stubs: { RouterLink: RouterLinkStub },
    mocks: { $route: `/projects/1/forms/${encodeURIComponent(form.xmlFormId)}` }
  });
};

describe('FormOverviewRightNow', () => {
  beforeEach(mockLogin);

  it('shows the version string of the primary form version', () => {
    testData.extendedForms.createPast(1);
    testData.extendedFormVersions.createPast(1, { version: 'v2', draft: true });
    const component = mountComponent();
    component.getComponent(FormVersionString).props().version.should.equal('v1');
  });

  it('toggles the "View XML" modal', () => {
    testData.extendedForms.createPast(1);
    return load('/projects/1/forms/f', { root: false }).testModalToggles({
      modal: FormVersionViewXml,
      show: '#form-overview-right-now .form-version-def-dropdown a',
      hide: '.btn-primary',
      respond: (series) => series.respondWithData(() => '<x/>')
    });
  });

  describe('form state', () => {
    it('renders correctly if the form is open', () => {
      testData.extendedForms.createPast(1, { state: 'open' });
      const items = mountComponent().findAllComponents(SummaryItem);
      items.length.should.equal(3);
      const item = items.at(1);
      item.props().icon.should.equal('exchange');
      item.get('.summary-item-heading').text().should.equal('Open');
      item.get('.summary-item-body').text().should.equal('This Form is downloadable and is accepting Submissions.');
    });

    it('renders correctly if the form is closing', () => {
      testData.extendedForms.createPast(1, { state: 'closing' });
      const item = mountComponent().findAllComponents(SummaryItem).at(1);
      item.props().icon.should.equal('clock-o');
      item.get('.summary-item-heading').text().should.equal('Closing');
      item.get('.summary-item-body').text().should.equal('This Form is not downloadable but still accepts Submissions.');
    });

    it('renders correctly if the form is closed', () => {
      testData.extendedForms.createPast(1, { state: 'closed' });
      const item = mountComponent().findAllComponents(SummaryItem).at(1);
      item.props().icon.should.equal('ban');
      item.get('.summary-item-heading').text().should.equal('Closed');
      item.get('.summary-item-body').text().should.equal('This Form is not downloadable and does not accept Submissions.');
    });
  });

  describe('submissions', () => {
    it('shows the count', () => {
      testData.extendedForms.createPast(1, { submissions: 123 });
      const items = mountComponent().findAllComponents(SummaryItem);
      items.length.should.equal(3);
      items.at(2).get('.summary-item-heading').text().should.equal('123');
    });

    it('links to the submissions page', () => {
      testData.extendedForms.createPast(1, { xmlFormId: 'a b' });
      const item = mountComponent().findAllComponents(SummaryItem).at(2);
      item.props().routeTo.should.equal('/projects/1/forms/a%20b/submissions');
    });
  });
});
