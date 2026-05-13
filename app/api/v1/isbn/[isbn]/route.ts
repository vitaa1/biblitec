import { NextRequest, NextResponse } from "next/server";

export type IsbnLookupResult = {
  titulo?: string;
  autores?: string;
  editora?: string;
  anoPublicacao?: number;
  descricao?: string;
  capaUrl?: string;
};

async function buscarOpenLibrary(isbn: string): Promise<IsbnLookupResult | null> {
  const res = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) return null;

  const json = await res.json();
  const livro = json[`ISBN:${isbn}`];
  if (!livro) return null;

  const autores = livro.authors
    ?.map((a: { name: string }) => a.name)
    .join(", ");

  const editora = livro.publishers?.[0]?.name;

  const ano = livro.publish_date
    ? Number(livro.publish_date.match(/\d{4}/)?.[0])
    : undefined;

  const capaUrl = livro.cover?.large ?? livro.cover?.medium ?? livro.cover?.small;

  return {
    titulo: livro.title || undefined,
    autores: autores || undefined,
    editora: editora || undefined,
    anoPublicacao: ano && !isNaN(ano) ? ano : undefined,
    descricao: livro.notes?.value || livro.notes || undefined,
    capaUrl: capaUrl || undefined,
  };
}

async function buscarGoogleBooks(isbn: string): Promise<IsbnLookupResult | null> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) return null;

  const json = await res.json();
  const item = json.items?.[0]?.volumeInfo;
  if (!item) return null;

  const capaUrl =
    item.imageLinks?.thumbnail?.replace("http://", "https://") ||
    item.imageLinks?.smallThumbnail?.replace("http://", "https://");

  return {
    titulo: item.title || undefined,
    autores: item.authors?.join(", ") || undefined,
    editora: item.publisher || undefined,
    anoPublicacao: item.publishedDate
      ? Number(item.publishedDate.slice(0, 4))
      : undefined,
    descricao: item.description || undefined,
    capaUrl: capaUrl || undefined,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ isbn: string }> },
) {
  const { isbn } = await params;
  const isbnLimpo = isbn.replace(/-/g, "");

  if (!/^\d{10}$|^\d{13}$/.test(isbnLimpo)) {
    return NextResponse.json(
      { error: "ISBN inválido. Informe 10 ou 13 dígitos." },
      { status: 400 },
    );
  }

  const resultado =
    (await buscarOpenLibrary(isbnLimpo)) ??
    (await buscarGoogleBooks(isbnLimpo));

  if (!resultado) {
    return NextResponse.json(
      { error: "ISBN não encontrado em nenhuma fonte." },
      { status: 404 },
    );
  }

  return NextResponse.json(resultado);
}
