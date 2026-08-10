const motivationSchemaRoot = 'motivation-schema';

// Api Versions
const v1 = 'v1';

export const routesV1 = {
    version: v1,
    motivationSchema: {
        root: motivationSchemaRoot,
        delete: `/${motivationSchemaRoot}/:id`,
    },
};
