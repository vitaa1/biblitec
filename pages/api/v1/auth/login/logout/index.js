export default function logout(request, response) {
  if (request.method !== "POST") {
    return response.status(405).end();
  }

  response.setHeader(
    "Set-Cookie",
    "token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict",
  );

  return response.status(200).json({
    message: "Logout realizado com sucesso.",
  });
}
