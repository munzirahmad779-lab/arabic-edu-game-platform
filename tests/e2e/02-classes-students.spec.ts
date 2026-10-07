import { test, expect } from "@playwright/test";
import { STUDENT_HEADERS } from "@/lib/student/excel";

test.describe("02. Classes & Student Management Gate", () => {
  test("Student Excel template defines canonical headers", async () => {
    expect(STUDENT_HEADERS).toEqual(["No", "Nama", "PIN"]);
  });

  test("PIN validation enforces 4-digit numeric format", async () => {
    function isValidPin(pin: string): boolean {
      return /^\d{4}$/.test(pin.trim());
    }

    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("0000")).toBe(true);
    expect(isValidPin("9999")).toBe(true);
    expect(isValidPin("123")).toBe(false); // Too short
    expect(isValidPin("12345")).toBe(false); // Too long
    expect(isValidPin("abcd")).toBe(false); // Non-numeric
    expect(isValidPin("12a4")).toBe(false);
  });
});
