import sinon from 'sinon';
import { RouterLinkStub } from '@vue/test-utils';

import Navbar from '../../../src/components/navbar.vue';
import NavbarActions from '../../../src/components/navbar/actions.vue';

import { load } from '../../util/http';
import { mockLogin } from '../../util/session';
import { mount } from '../../util/lifecycle';

describe('NavbarActions', () => {
  it('indicates if the user is not logged in', () => {
    const navbar = mount(Navbar, {
      // Stubbing AnalyticsIntroduction because of its custom <router-link>
      stubs: { RouterLink: RouterLinkStub, AnalyticsIntroduction: true },
      mocks: { $route: '/login' }
    });
    const text = navbar.getComponent(NavbarActions).get('a').text();
    text.should.equal('Not logged in');
  });

  it("shows the user's display name", () => {
    mockLogin({ displayName: 'Alice' });
    const navbar = mount(Navbar, {
      stubs: { RouterLink: RouterLinkStub, AnalyticsIntroduction: true },
      mocks: { $route: '/' }
    });
    navbar.getComponent(NavbarActions).get('a').text().should.equal('Alice');
  });

  describe('after the user clicks "Log out"', () => {
    beforeEach(() => {
      mockLogin({ role: 'none' });
    });

    it('logs out', () =>
      load('/account/edit')
        .complete()
        .request(app => app.get('#navbar-actions-log-out').trigger('click'))
        .respondWithSuccess()
        .afterResponse(app => {
          should.not.exist(app.vm.$store.state.request.data.session);
        }));

    it('does not set the ?next query parameter', () =>
      load('/account/edit')
        .complete()
        .request(app => app.get('#navbar-actions-log-out').trigger('click'))
        .respondWithSuccess()
        .afterResponse(app => {
          app.vm.$route.fullPath.should.equal('/login');
        }));

    it('shows a success alert', () =>
      load('/account/edit')
        .complete()
        .request(app => app.get('#navbar-actions-log-out').trigger('click'))
        .respondWithSuccess()
        .afterResponse(app => {
          app.should.alert('success', 'You have logged out successfully.');
        }));

    it('does not log out if the user does not confirm unsaved changes', () => {
      sinon.replace(window, 'confirm', () => false);
      return load('/account/edit')
        .afterResponses(app => {
          app.vm.$store.commit('setUnsavedChanges', true);
        })
        .testNoRequest(app =>
          app.get('#navbar-actions-log-out').trigger('click'));
    });
  });
});
