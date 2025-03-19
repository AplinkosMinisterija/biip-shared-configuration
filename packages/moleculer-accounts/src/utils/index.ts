import { Context } from 'moleculer';
import _ from 'lodash';
export * from './tokens';
export * from './functions';
export * from './boundaries';

type ActionType = string | { [key: string]: string };

const PromiseAllObject = (obj: any) => {
  if (obj && !obj[Symbol.iterator]) {
    return Promise.all(Object.entries(obj).map(async ([k, v]) => [k, await v])).then(
      (Object as any).fromEntries,
    );
  }
  return Promise.all(obj);
};

export function PopulateHandlerFn(action: ActionType) {
  const populateSubproperties = _.isObject(action);

  return async function (
    ctx: Context<{ populate: string | string[] }>,
    values: any[],
    docs: any[],
    field: any,
  ) {
    if (!values.length) return null;
    const rule = field.populate;
    let populate = rule.params?.populate;
    if (rule.inheritPopulate) {
      populate = ctx.params.populate;
    }

    let fieldName = field.name;
    if (rule.keyField) {
      fieldName = rule.keyField;
    }

    async function getValuesByKey(values: any[], action: ActionType): Promise<any> {
      if (_.isObject(action)) {
        const promisesByActionKeys = Object.keys(action).reduce((acc: any, key: string) => {
          const keyValues = values.map((v) => v[key]);

          return { ...acc, [key]: getValuesByKey(keyValues, action[key]) };
        }, {});

        return PromiseAllObject(promisesByActionKeys);
      }

      const params = {
        ...(rule.params || {}),
        id: values,
        mapping: true,
        populate,
        throwIfNotExist: false,
      };

      return ctx.call(action, params, rule.callOptions);
    }

    const byKey: any = await getValuesByKey(values, action);

    function mapValues(fieldValue: any) {
      return Object.keys(fieldValue).reduce((acc: any, key: string) => {
        let value = fieldValue[key];
        if (!value) return acc;

        if (byKey[key]) {
          if (!fieldValue[key]) return acc;
          value = byKey[key][`${fieldValue[key]}`];
        }

        return { ...acc, [key]: value };
      }, {});
    }

    return docs?.map((d) => {
      const fieldValue = d[fieldName];
      if (!fieldValue) return null;

      if (populateSubproperties) {
        if (Array.isArray(fieldValue)) {
          return fieldValue.map(mapValues);
        }
        return mapValues(fieldValue);
      }
      return byKey[fieldValue] || null;
    });
  };
}
