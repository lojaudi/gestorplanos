import { supabase } from "@/integrations/supabase/client";

interface EditClientParams {
  clientId: string;
  userId: string;
  newPlanId: string | null;
  newDueDate: string; // YYYY-MM-DD
  oldPlanId: string | null;
  oldDueDate: string; // YYYY-MM-DD
}

interface EditClientResult {
  success: boolean;
  message: string;
  invoiceDeleted: boolean;
  invoiceCreated: boolean;
}

/**
 * Edita plano e/ou vencimento de um cliente, sincronizando faturas automaticamente.
 *
 * Regras:
 * - Se o plano mudou OU a data de vencimento mudou, exclui faturas pendentes e gera nova.
 * - Se nada mudou, apenas atualiza o cliente sem tocar faturas.
 * - Valida se o plano existe antes de prosseguir.
 */
export async function editClientWithInvoiceSync(params: EditClientParams): Promise<EditClientResult> {
  const { clientId, userId, newPlanId, newDueDate, oldPlanId, oldDueDate } = params;

  const planChanged = newPlanId !== oldPlanId;
  const dueDateChanged = newDueDate !== oldDueDate;

  // Validate plan if provided
  let planPrice: number = 0;
  let planName = "";
  if (newPlanId) {
    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("id, name, price")
      .eq("id", newPlanId)
      .single();
    if (planErr || !plan) {
      return { success: false, message: "Plano inválido ou não encontrado.", invoiceDeleted: false, invoiceCreated: false };
    }
    planPrice = plan.price ?? 0;
    planName = plan.name;
  }

  // Update client record
  const { error: clientErr } = await supabase
    .from("clients")
    .update({ plan_id: newPlanId || null, due_date: newDueDate })
    .eq("id", clientId);

  if (clientErr) {
    return { success: false, message: `Erro ao atualizar cliente: ${clientErr.message}`, invoiceDeleted: false, invoiceCreated: false };
  }

  // If nothing invoice-relevant changed, done
  if (!planChanged && !dueDateChanged) {
    return { success: true, message: "Cliente atualizado com sucesso.", invoiceDeleted: false, invoiceCreated: false };
  }

  // Check for existing pending invoices
  const { data: existingInvoices } = await supabase
    .from("invoices")
    .select("id, due_date, status")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .in("status", ["pending", "overdue"]);

  let invoiceDeleted = false;
  let invoiceCreated = false;

  // Delete pending invoices whose due_date differs or plan changed
  if (existingInvoices && existingInvoices.length > 0) {
    const toDelete = existingInvoices.filter(
      (inv) => planChanged || inv.due_date !== newDueDate
    );
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("invoices")
        .delete()
        .in("id", toDelete.map((i) => i.id));
      if (delErr) {
        return { success: true, message: `Cliente atualizado, mas erro ao excluir faturas: ${delErr.message}`, invoiceDeleted: false, invoiceCreated: false };
      }
      invoiceDeleted = true;
    }
  }

  // Create new invoice if there's a plan
  if (newPlanId) {
    const { error: insertErr } = await supabase.from("invoices").insert({
      user_id: userId,
      client_id: clientId,
      plan_id: newPlanId,
      amount: planPrice,
      due_date: newDueDate,
      status: "pending",
      description: planName,
    });
    if (insertErr) {
      return { success: true, message: `Cliente atualizado, mas erro ao criar fatura: ${insertErr.message}`, invoiceDeleted, invoiceCreated: false };
    }
    invoiceCreated = true;
  }

  // Build feedback message
  const parts: string[] = [];
  if (planChanged) parts.push("Plano atualizado");
  if (dueDateChanged) parts.push("Data de vencimento atualizada");
  if (invoiceDeleted) parts.push("Fatura antiga excluída");
  if (invoiceCreated) parts.push("Nova fatura gerada");

  return {
    success: true,
    message: parts.join(". ") + ".",
    invoiceDeleted,
    invoiceCreated,
  };
}
