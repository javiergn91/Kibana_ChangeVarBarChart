export default function (kibana) {
  return new kibana.Plugin({
    require: ['elasticsearch'],
    name: 'service_status_barchart',
    uiExports: {
      visTypes: ['plugins/service_status_barchart/entry']
    },

    config(Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
      }).default();
    },
  });
}
