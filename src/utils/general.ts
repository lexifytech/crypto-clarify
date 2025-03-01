export async function retryOperation(
  operation: () => Promise<any>,
  delay = 1000,
  maxAttempts = 5
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxAttempts) {
        return null
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
