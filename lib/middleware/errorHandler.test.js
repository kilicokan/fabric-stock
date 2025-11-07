import { errorHandler } from './errorHandler';

describe('Error Handler Middleware', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn(() => mockResponse),
      json: jest.fn(() => mockResponse)
    };
    nextFunction = jest.fn();
  });

  test('handles validation errors', () => {
    const validationError = {
      type: 'validation',
      message: 'Invalid input'
    };

    errorHandler(validationError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Validation Error',
      details: 'Invalid input'
    });
  });

  test('handles not found errors', () => {
    const notFoundError = {
      code: 'P2025',
      message: 'Record not found'
    };

    errorHandler(notFoundError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: 'The requested resource was not found'
    });
  });

  test('handles internal server errors', () => {
    const serverError = new Error('Database connection failed');
    process.env.NODE_ENV = 'production';

    errorHandler(serverError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  });
});