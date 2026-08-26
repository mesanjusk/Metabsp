// Ported from frontend/src/utils/parseApiError.js, unchanged in behaviour so
// the error text a user sees does not depend on which deployment served them.
export function parseApiError(error: any, fallback = 'Something went wrong. Please try again.'): string {
  const responseData = error?.response?.data;

  if (typeof responseData === 'string') return responseData;
  if (responseData?.message) return responseData.message;
  if (responseData?.error?.message) return responseData.error.message;
  if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
    return responseData.errors[0]?.message || fallback;
  }

  return error?.message || fallback;
}

export default parseApiError;
