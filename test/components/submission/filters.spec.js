import { DateTime, Settings } from 'luxon';

import sinon from 'sinon';

import DateRangePicker from '../../../src/components/date-range-picker.vue';
import SubmissionMetadataRow from '../../../src/components/submission/metadata-row.vue';

import testData from '../../data';
import { load } from '../../util/http';
import { loadSubmissionList } from '../../util/submission';
import { mockLogin } from '../../util/session';

describe('SubmissionFilters', () => {
  beforeEach(mockLogin);

  it('initially does not filter submissions', () => {
    testData.extendedForms.createPast(1);
    return loadSubmissionList()
      .beforeEachResponse((_, { url }) => {
        url.should.not.containEql('%24filter=');
      });
  });

  it('sends a request after the submitter filter is changed', () => {
    testData.extendedProjects.createPast(1, { forms: 1, appUsers: 1 });
    testData.extendedForms.createPast(1, { submissions: 1 });
    const fieldKey = testData.extendedFieldKeys.createPast(1).last();
    testData.extendedSubmissions.createPast(1, { submitter: fieldKey });
    return loadSubmissionList()
      .complete()
      .request(component => {
        const select = component.get('#submission-filters-submitter select');
        return select.setValue(fieldKey.id.toString());
      })
      .beforeEachResponse((_, { url }) => {
        const match = url.match(/&%24filter=__system%2FsubmitterId\+eq\+(\d+)(&|$)/);
        should.exist(match);
        match[1].should.equal(fieldKey.id.toString());
      })
      .respondWithData(testData.submissionOData);
  });

  it('re-renders the table after the submitter filter is changed', () => {
    testData.extendedProjects.createPast(1, { forms: 1, appUsers: 1 });
    testData.extendedForms.createPast(1, { submissions: 3 });
    const fieldKey = testData.extendedFieldKeys.createPast(1).last();
    testData.extendedSubmissions.createPast(3, { submitter: fieldKey });
    return loadSubmissionList({
      propsData: { top: () => 2 }
    })
      .complete()
      .request(component => {
        sinon.replace(component.vm, 'scrolledToBottom', () => true);
        document.dispatchEvent(new Event('scroll'));
      })
      .respondWithData(() => testData.submissionOData(2, 2))
      .afterResponse(component => {
        component.findAllComponents(SubmissionMetadataRow).length.should.equal(3);
      })
      .request(component => {
        const select = component.get('#submission-filters-submitter select');
        return select.setValue(fieldKey.id.toString());
      })
      .beforeEachResponse(component => {
        component.findComponent(SubmissionMetadataRow).exists().should.be.false();
      })
      .respondWithData(() => testData.submissionOData(2, 0))
      .afterResponse(component => {
        component.findAllComponents(SubmissionMetadataRow).length.should.equal(2);
      });
  });

  it('sends a request after the submission date filter is changed', () => {
    testData.extendedForms.createPast(1);
    return loadSubmissionList()
      .complete()
      .request(component => {
        component.getComponent(DateRangePicker).vm.close([
          DateTime.fromISO('1970-01-01').toJSDate(),
          DateTime.fromISO('1970-01-02').toJSDate()
        ]);
      })
      .beforeEachResponse((_, { url }) => {
        const match = url.match(/&%24filter=__system%2FsubmissionDate\+ge\+([^+]+)\+and\+__system%2FsubmissionDate\+le\+([^+]+)(&|$)/);
        should.exist(match);

        const start = decodeURIComponent(match[1]);
        start.should.startWith('1970-01-01T00:00:00.000');
        DateTime.fromISO(start).zoneName.should.equal(Settings.defaultZoneName);

        const end = decodeURIComponent(match[2]);
        end.should.startWith('1970-01-02T23:59:59.999');
        DateTime.fromISO(end).zoneName.should.equal(Settings.defaultZoneName);
      })
      .respondWithData(testData.submissionOData);
  });

  it('sends a request after the review state filter is changed', () => {
    testData.extendedForms.createPast(1);
    return loadSubmissionList()
      .complete()
      .request(component => {
        const select = component.get('#submission-filters-review-state select');
        return select.setValue('null');
      })
      .beforeEachResponse((_, { url }) => {
        url.should.match(/&%24filter=%28__system%2FreviewState\+eq\+null%29(&|$)/);
      })
      .respondWithData(testData.submissionOData);
  });

  it.skip('allows multiple review states to be selected', () => {
    testData.extendedForms.createPast(1);
    return loadSubmissionList()
      .complete()
      .request(component => {
        const select = component.get('#submission-filters-review-state select');
        const options = select.findAll('option');
        options.at(0).element.selected = true;
        options.at(1).element.selected = true;
        return select.trigger('change');
      })
      .beforeEachResponse((_, { url }) => {
        url.should.match(/&%24filter=%28__system%2FreviewState\+eq\+null\+or\+__system%2FreviewState\+eq\+%27approved%27%29(&|$)/);
      })
      .respondWithData(testData.submissionOData);
  });

  it('specifies all the filters in the query parameter', () => {
    testData.extendedProjects.createPast(1, { forms: 1, appUsers: 1 });
    testData.extendedForms.createPast(1, { submissions: 1 });
    const fieldKey = testData.extendedFieldKeys.createPast(1).last();
    testData.extendedSubmissions.createPast(1, { submitter: fieldKey });
    return loadSubmissionList()
      .complete()
      .request(component => {
        const select = component.get('#submission-filters-submitter select');
        return select.setValue(fieldKey.id.toString());
      })
      .respondWithData(testData.submissionOData)
      .complete()
      .request(component => {
        component.getComponent(DateRangePicker).vm.close([
          DateTime.fromISO('1970-01-01').toJSDate(),
          DateTime.fromISO('1970-01-02').toJSDate()
        ]);
      })
      .respondWithData(() => testData.submissionOData(0))
      .complete()
      .request(component => {
        const select = component.get('#submission-filters-review-state select');
        return select.setValue('null');
      })
      .beforeEachResponse((_, { url }) => {
        url.should.match(/&%24filter=__system%2FsubmitterId\+eq\+\d+\+and\+__system%2FsubmissionDate\+ge\+[^+]+\+and\+__system%2FsubmissionDate\+le\+[^+]+\+and\+%28__system%2FreviewState\+eq\+null%29(&|$)/);
      })
      .respondWithData(() => testData.submissionOData(0));
  });

  it('numbers the rows based on the number of filtered submissions', () => {
    testData.extendedProjects.createPast(1, { forms: 1, appUsers: 2 });
    testData.extendedForms.createPast(1, { submissions: 2 });
    testData.extendedSubmissions.createPast(1, {
      submitter: testData.extendedFieldKeys.createPast(1).last()
    });
    testData.extendedSubmissions.createPast(1, {
      submitter: testData.extendedFieldKeys.createPast(1).last()
    });
    return loadSubmissionList()
      .complete()
      .request(component => {
        const select = component.get('#submission-filters-submitter select');
        return select.setValue(testData.extendedFieldKeys.last().id.toString());
      })
      .respondWithData(() => ({
        value: [testData.extendedSubmissions.last()._odata],
        '@odata.count': 1
      }))
      .afterResponse(component => {
        component.getComponent(SubmissionMetadataRow).props().rowNumber.should.equal(1);
      });
  });

  it('does not update form.submissions', () => {
    testData.extendedProjects.createPast(1, { forms: 1, appUsers: 2 });
    testData.extendedForms.createPast(1, { submissions: 2 });
    testData.extendedSubmissions.createPast(1, {
      submitter: testData.extendedFieldKeys.createPast(1).last()
    });
    testData.extendedSubmissions.createPast(1, {
      submitter: testData.extendedFieldKeys.createPast(1).last()
    });
    return load('/projects/1/forms/f/submissions', { root: false })
      .afterResponses(component => {
        component.vm.$store.state.request.data.form.submissions.should.equal(2);
      })
      .request(component => {
        const select = component.get('#submission-filters-submitter select');
        return select.setValue(testData.extendedFieldKeys.last().id.toString());
      })
      .respondWithData(() => ({
        value: [testData.extendedSubmissions.last()._odata],
        '@odata.count': 1
      }))
      .afterResponse(component => {
        component.vm.$store.state.request.data.form.submissions.should.equal(2);
      });
  });

  describe('loading message', () => {
    it('shows the correct message for the first chunk', () => {
      testData.extendedProjects.createPast(1, { forms: 1, appUsers: 1 });
      testData.extendedForms.createPast(1, { submissions: 3 });
      const fieldKey = testData.extendedFieldKeys.createPast(1).last();
      testData.extendedSubmissions.createPast(3, { submitter: fieldKey });
      return loadSubmissionList({
        propsData: { top: () => 2 }
      })
        .complete()
        .request(component => {
          const select = component.get('#submission-filters-submitter select');
          return select.setValue(fieldKey.id.toString());
        })
        .beforeEachResponse(component => {
          const text = component.get('#submission-list-message-text').text();
          text.trim().should.equal('Loading matching Submissions…');
        })
        .respondWithData(() => testData.submissionOData(2, 0));
    });

    it('shows the correct message for the second chunk', () => {
      testData.extendedProjects.createPast(1, { forms: 1, appUsers: 1 });
      testData.extendedForms.createPast(1, { submissions: 5 });
      const fieldKey = testData.extendedFieldKeys.createPast(1).last();
      testData.extendedSubmissions.createPast(5, { submitter: fieldKey });
      return loadSubmissionList({
        propsData: { top: () => 2 }
      })
        .complete()
        .request(component => {
          const select = component.get('#submission-filters-submitter select');
          return select.setValue(fieldKey.id.toString());
        })
        .respondWithData(() => testData.submissionOData(2, 0))
        .complete()
        .request(component => {
          sinon.replace(component.vm, 'scrolledToBottom', () => true);
          document.dispatchEvent(new Event('scroll'));
        })
        .beforeEachResponse(component => {
          const text = component.get('#submission-list-message-text').text();
          text.trim().should.equal('Loading 2 more of 3 remaining matching Submissions…');
        })
        .respondWithData(() => testData.submissionOData(2, 2));
    });

    describe('last chunk', () => {
      it('shows correct message if there is one submission remaining', () => {
        testData.extendedProjects.createPast(1, { forms: 1, appUsers: 1 });
        testData.extendedForms.createPast(1, { submissions: 3 });
        const fieldKey = testData.extendedFieldKeys.createPast(1).last();
        testData.extendedSubmissions.createPast(3, { submitter: fieldKey });
        return loadSubmissionList({
          propsData: { top: () => 2 }
        })
          .complete()
          .request(component => {
            const select = component.get('#submission-filters-submitter select');
            return select.setValue(fieldKey.id.toString());
          })
          .respondWithData(() => testData.submissionOData(2, 0))
          .complete()
          .request(component => {
            sinon.replace(component.vm, 'scrolledToBottom', () => true);
            document.dispatchEvent(new Event('scroll'));
          })
          .beforeEachResponse(component => {
            const text = component.get('#submission-list-message-text').text();
            text.trim().should.equal('Loading the last matching Submission…');
          })
          .respondWithData(() => testData.submissionOData(2, 2));
      });

      it('shows correct message if there is are multiple submissions remaining', () => {
        testData.extendedProjects.createPast(1, { forms: 1, appUsers: 1 });
        testData.extendedForms.createPast(1, { submissions: 4 });
        const fieldKey = testData.extendedFieldKeys.createPast(1).last();
        testData.extendedSubmissions.createPast(4, { submitter: fieldKey });
        return loadSubmissionList({
          propsData: { top: () => 2 }
        })
          .complete()
          .request(component => {
            const select = component.get('#submission-filters-submitter select');
            return select.setValue(fieldKey.id.toString());
          })
          .respondWithData(() => testData.submissionOData(2, 0))
          .complete()
          .request(component => {
            sinon.replace(component.vm, 'scrolledToBottom', () => true);
            document.dispatchEvent(new Event('scroll'));
          })
          .beforeEachResponse(component => {
            const text = component.get('#submission-list-message-text').text();
            text.trim().should.equal('Loading the last 2 matching Submissions…');
          })
          .respondWithData(() => testData.submissionOData(2, 2));
      });
    });
  });
});
