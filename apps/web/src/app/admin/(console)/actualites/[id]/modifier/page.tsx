import { AdminArticleForm } from "@/components/admin/admin-article-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminArticleEditPage({ params }: PageProps) {
  const { id } = await params;

  if (!id) {
    return <p className="admin-dash__muted">Actualité introuvable</p>;
  }

  return <AdminArticleForm mode="edit" articleId={id} />;
}
