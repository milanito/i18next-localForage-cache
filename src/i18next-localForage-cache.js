import Promise from 'bluebird';
import debounce from 'debounce';
import localForage from 'localforage';
import moment from 'moment';
import {
  merge, map, filter, isUndefined, isEqual, reduce, set, get, join,
  isNull, isEmpty, clone, omit
} from 'lodash';

const DEFAULT_OPTIONS = {
  enabled: false,
  prefix: 'i18next_fres_',
  expirationTime: 7 * 24 * 60 * 60 * 1000,
  versions: {}
};

class Cache {
  constructor(services, options = {}) {
    this.init(services, options);

    this.type = 'cache';
    this.debouncedStore = debounce(this.store, 10000);
  }

  init(services, options = {}) {
    this.services = services;
    this.options = merge(DEFAULT_OPTIONS, this.options || {}, options);
  }

  load(lngs, cb) {
    const { prefix, expirationTime, versions } = this.options;

    return Promise.all(map(lngs, lng =>
      localForage.getItem(join([prefix, lng], ''))
      .then(value => ({ lng, value }))
    ))
    .then(values => filter(values, ({ value }) =>
      !isUndefined(value) && !isNull(value) && !isEmpty(value)))
    .then(values => filter(values, ({ value }) =>
      moment(value.i18nStamp).add(expirationTime, 'ms').isAfter(moment())))
    .then(values => filter(values, ({ lng, value }) =>
      isEqual(value.i18nVersion, get(versions, lng))))
    .then(values => cb(null, reduce(values, (total, { lng, value }) =>
        merge(total, set({}, lng, omit(value, ['i18nStamp']))), {})))
    .catch(err => cb(err));
  }

  store(storeParams) {
    const { versions, prefix } = this.options;

    return Promise.all(map(storeParams, (value, lng) => {
      const item = merge(clone(value), {
        i18nStamp: moment().valueOf()
      });

      if (!isUndefined(get(versions, lng, undefined))) {
        set(item, 'i18nVersion', get(versions, lng, undefined));
      }

      return localForage.setItem(join([prefix, lng], ''), item);
    }));
  }

  save(store) {
    this.debouncedStore(store);
  }
}

Cache.type = 'cache';

export default Cache;
