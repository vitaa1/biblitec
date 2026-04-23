test("POST /api/v1/migrations without auth should return 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/migrations", {
    method: "POST",
  });

  expect(response.status).toBe(401);

  const responseBody = await response.json();
  expect(responseBody.error).toBe("Não autorizado.");
});
