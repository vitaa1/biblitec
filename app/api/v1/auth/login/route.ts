import jwt from "jsonwebtoken";
import user from "models/user";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json(
        { error: "Email e senha são obrigatórios." },
        { status: 400 },
      );
    }

    const existingUser = await user.findOneByEmail(email);
    if (!existingUser) {
      return Response.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const passwordMatch = await user.validatePassword(
      password,
      existingUser.password,
    );
    if (!passwordMatch) {
      return Response.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const token = jwt.sign(
      {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" },
    );

    const response = NextResponse.json({
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 86400,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
