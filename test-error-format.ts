import { ApplicationError } from "@justinmchase/grove";

const err = new ApplicationError(400, "TEST_CODE", "test message");
console.log(JSON.stringify({
  status: err.status,
  code: err.code,
  message: err.message,
  name: err.name,
}));
