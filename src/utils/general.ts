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
        throw new Error(
          `Operation failured after ${maxAttempts} attempts: ${error.message}`
        );
      }
      console.log(
        `Attempt ${attempt} failured. retrying in ${delay} ms...`,
        error.message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
