/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*/

define(function (require, exports, module) {
  'use strict';

  var _ = require('underscore');
  var $ = require('jquery');
  require('jquery-timeago');
  var Cocktail = require('cocktail');
  var Devices = require('models/devices');
  var FormView = require('views/form');
  var preventDefaultThen = require('views/base').preventDefaultThen;
  var SettingsPanelMixin = require('views/mixins/settings-panel-mixin');
  var SignedOutNotificationMixin = require('views/mixins/signed-out-notification-mixin');
  var t = require('views/base').t;
  var Template = require('stache!templates/settings/devices');
  var Url = require('lib/url');

  var DEVICE_REMOVED_ANIMATION_MS = 150;
  var DEVICES_SUPPORT_URL = 'https://support.mozilla.org/kb/fxa-managing-devices';
  var UTM_PARAMS = '?utm_source=accounts.firefox.com&utm_medium=referral&utm_campaign=fxa-devices';
  var FIREFOX_DOWNLOAD_LINK = 'https://www.mozilla.org/firefox/new/' + UTM_PARAMS;
  var FIREFOX_ANDROID_DOWNLOAD_LINK = 'https://www.mozilla.org/firefox/android/' + UTM_PARAMS;
  var FIREFOX_IOS_DOWNLOAD_LINK = 'https://www.mozilla.org/firefox/ios/' +  UTM_PARAMS;
  var FORCE_DEVICE_LIST_VIEW = 'forceDeviceList';
  var TIMEAGO_DAYS = t('Last active: days ago');
  var TIMEAGO_HOURS = t('Last active: hours ago');
  var TIMEAGO_MINUTES = t('Last active: minutes ago');
  var TIMEAGO_MONTHS = t('Last active: months ago');
  var TIMEAGO_SECONDS = t('Last active: seconds ago');
  var TIMEAGO_SUFFIX = '';
  var TIMEAGO_WEEKS = t('Last active: weeks ago');
  var TIMEAGO_YEARS = t('Last active: years ago');

  _.extend($.timeago.settings.strings, {
    day: TIMEAGO_DAYS,
    days: TIMEAGO_DAYS,
    hour: TIMEAGO_HOURS,
    hours: TIMEAGO_HOURS,
    minute: TIMEAGO_MINUTES,
    minutes: TIMEAGO_MINUTES,
    month: TIMEAGO_MONTHS,
    months: TIMEAGO_MONTHS,
    seconds: TIMEAGO_SECONDS,
    suffixAgo: TIMEAGO_SUFFIX,
    week: TIMEAGO_WEEKS,
    weeks: TIMEAGO_WEEKS,
    year: TIMEAGO_YEARS,
    years: TIMEAGO_YEARS
  });

  var View = FormView.extend({
    template: Template,
    className: 'devices',
    viewName: 'settings.devices',

    initialize: function (options) {
      this._able = options.able;
      this._devices = options.devices;

      // An empty Devices instance is created to render the initial view.
      // Data is only fetched once the panel has been opened.
      if (! this._devices) {
        this._devices = new Devices([], {
          notifier: options.notifier
        });
      }

      var devices = this._devices;
      devices.on('add', this._onDeviceAdded.bind(this));
      devices.on('remove', this._onDeviceRemoved.bind(this));
    },

    _formatDevicesList: function (devices) {
      return _.map(devices, function (device) {
        device.lastAccessTime = $.timeago(Number(device.lastAccessTime));
        return device;
      });
    },

    context: function () {
      return {
        devices: this._formatDevicesList(this._devices.toJSON()),
        devicesSupportUrl: DEVICES_SUPPORT_URL,
        isPanelEnabled: this._isPanelEnabled(),
        isPanelOpen: this.isPanelOpen(),
        linkAndroid: FIREFOX_ANDROID_DOWNLOAD_LINK,
        linkIOS: FIREFOX_IOS_DOWNLOAD_LINK,
        linkLinux: FIREFOX_DOWNLOAD_LINK,
        linkOSX: FIREFOX_DOWNLOAD_LINK,
        linkWindows: FIREFOX_DOWNLOAD_LINK
      };
    },

    events: {
      'click .device-disconnect': preventDefaultThen('_onDisconnectDevice'),
      'click .devices-refresh': preventDefaultThen('_onRefreshDeviceList')
    },

    _isPanelEnabled: function () {
      return this._able.choose('deviceListVisible', {
        forceDeviceList: Url.searchParam(FORCE_DEVICE_LIST_VIEW, this.window.location.search)
      });
    },

    _onDeviceAdded: function () {
      this.render();
    },

    _onDeviceRemoved: function (device) {
      var id = device.get('id');
      var self = this;
      $('#' + id).slideUp(DEVICE_REMOVED_ANIMATION_MS, function () {
        // re-render in case the last device is removed and the
        // "no registered devices" message needs to be shown.
        self.render();
      });
    },

    _onDisconnectDevice: function (event) {
      this.logViewEvent('disconnect');
      var deviceId = $(event.currentTarget).attr('data-id');
      this._destroyDevice(deviceId);
    },

    _onRefreshDeviceList: function () {
      var self = this;
      if (this.isPanelOpen()) {
        this.logViewEvent('refresh');
        // only refresh devices if panel is visible
        // if panel is hidden there is no point of fetching devices
        this._fetchDevices().then(function () {
          self.render();
        });
      }
    },

    openPanel: function () {
      this.logViewEvent('open');
      this._fetchDevices();
    },

    _fetchDevices: function () {
      var account = this.getSignedInAccount();

      return this.user.fetchAccountDevices(account, this._devices);
    },

    _destroyDevice: function (deviceId) {
      var self = this;
      var account = this.getSignedInAccount();
      var device = this._devices.get(deviceId);
      if (device) {
        this.user.destroyAccountDevice(account, device)
          .then(function () {
            if (device.get('isCurrentDevice')) {
              self.navigateToSignIn();
            }
          });
      }
    }
  });

  Cocktail.mixin(
    View,
    SettingsPanelMixin,
    SignedOutNotificationMixin
  );

  module.exports = View;
});
