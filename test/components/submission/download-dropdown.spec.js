import SubmissionDownloadButton from '../../../src/components/submission/download-dropdown.vue';

import testData from '../../data';
import { mount } from '../../util/lifecycle';

const mountComponent = (options = {}) => mount(SubmissionDownloadButton, {
  ...options,
  propsData: {
    formVersion: testData.extendedForms.last(),
    ...options.propsData
  }
});

describe('SubmissionDownloadButton', () => {
  describe('text', () => {
    it('shows the correct text if the submissions are not filtered', () => {
      testData.extendedForms.createPast(1, { submissions: 2 });
      const text = mountComponent().get('button').text();
      text.should.equal('Download 2 records…');
    });

    describe('submissions are filtered', () => {
      it('shows correct text while first chunk of submissions is loading', () => {
        testData.extendedForms.createPast(1, { submissions: 2 });
        const dropdown = mountComponent({
          propsData: { filtered: true }
        });
        const text = dropdown.get('button').text();
        text.should.equal('Download matching records…');
      });

      it('shows correct text after first chunk of submissions has loaded', async () => {
        testData.extendedForms.createPast(1, { submissions: 2 });
        const dropdown = mountComponent({
          propsData: { filtered: true }
        });
        dropdown.vm.$store.commit('setData', {
          key: 'odataChunk',
          value: { '@odata.count': 1 }
        });
        await dropdown.vm.$nextTick();
        const text = dropdown.get('button').text();
        text.should.equal('Download 1 matching record…');
      });
    });
  });
});
