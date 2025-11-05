const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'POS Software API',
      version: '1.0.0',
      description: 'Comprehensive Point of Sale API for Restaurants, Pharmacies, Electronics stores, and Supershops',
      contact: {
        name: 'POS Software Team',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 4000}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
            role: { 
              type: 'string', 
              enum: ['super_admin', 'admin', 'manager', 'cashier', 'waiter', 'pharmacist', 'kitchen_staff', 'editor', 'seller']
            },
            storeIds: { type: 'array', items: { type: 'string' } },
          },
        },
        Product: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            sku: { type: 'string' },
            barcode: { type: 'string' },
            category: { type: 'string' },
            price: { type: 'number' },
            cost: { type: 'number' },
            stock: { type: 'number' },
            variants: { type: 'array' },
          },
        },
        Sale: {
          type: 'object',
          properties: {
            storeId: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'number' },
                  price: { type: 'number' },
                },
              },
            },
            payments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  method: { type: 'string' },
                  amount: { type: 'number' },
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            status: { type: 'number' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./route/*.js', './server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
