"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import { paymentsApi } from "@/lib/api";

const stripeCache = new Map<string, Promise<Stripe | null>>();

function getStripe(publishableKey: string) {
  let promise = stripeCache.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripeCache.set(publishableKey, promise);
  }
  return promise;
}

type StripePaymentModalProps = {
  paymentId: string;
  clientSecret: string;
  publishableKey: string;
  amountValue: string;
  planName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  /** Chemin de retour après 3DS (défaut abonnement). */
  returnPath?: string;
  headNote?: string;
  onClose: () => void;
  onSuccess: (paymentId: string) => void;
};

function StripePayForm({
  paymentId,
  amountValue,
  planName,
  customerName,
  customerEmail,
  customerPhone,
  returnPath = "/abonnement/retour",
  headNote = "Règlement sécurisé de votre abonnement STUDRC.",
  onClose,
  onSuccess,
}: Omit<StripePaymentModalProps, "clientSecret" | "publishableKey">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    try {
      const sep = returnPath.includes("?") ? "&" : "?";
      const returnUrl = `${window.location.origin}${returnPath}${sep}payment=${encodeURIComponent(paymentId)}`;
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: {
            billing_details: {
              name: customerName.trim() || customerEmail,
              email: customerEmail,
              ...(customerPhone?.trim()
                ? { phone: customerPhone.trim() }
                : {}),
            },
          },
        },
        redirect: "if_required",
      });

      if (error) {
        toast.error(error.message || "Paiement refusé");
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        await paymentsApi.confirmStripe(paymentId, {
          paymentIntentId: paymentIntent.id,
        });
        onSuccess(paymentId);
        return;
      }

      if (
        paymentIntent?.status === "processing" ||
        paymentIntent?.status === "requires_action"
      ) {
        toast.info("Paiement en cours de confirmation…");
        onSuccess(paymentId);
        return;
      }

      toast.error("Paiement non finalisé — réessayez");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec du paiement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="opt-abo-stripe" onSubmit={(e) => void onSubmit(e)}>
      <div className="opt-abo-stripe__head">
        <div className="opt-abo-stripe__head-text">
          <h2 id="opt-abo-stripe-title">Paiement par carte</h2>
          <p className="opt-abo-stripe__head-note">{headNote}</p>
        </div>
        <button
          type="button"
          className="opt-abo-stripe__close"
          aria-label="Fermer"
          onClick={onClose}
          disabled={submitting}
        >
          <X size={18} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <div className="opt-abo-stripe__amount">
        <span className="opt-abo-stripe__amount-value">{amountValue}</span>
        <span className="opt-abo-stripe__amount-plan">{planName}</span>
      </div>
      <div className="opt-abo-stripe__element">
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: {
              link: "never",
              applePay: "auto",
              googlePay: "auto",
            },
            fields: {
              billingDetails: {
                email: "never",
                name: "never",
              },
            },
          }}
        />
      </div>
      <button
        type="submit"
        className="opt-abo__cta opt-abo-stripe__submit"
        disabled={!stripe || !elements || submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="opt-abo__spin" size={18} aria-hidden />
            Paiement…
          </>
        ) : (
          "Payer maintenant"
        )}
      </button>
      <button
        type="button"
        className="opt-abo__cta-ghost opt-abo-stripe__cancel"
        onClick={onClose}
        disabled={submitting}
      >
        Annuler
      </button>
      <p className="opt-abo-stripe__secure">
        <span className="opt-abo-stripe__secure-icons" aria-hidden>
          <ShieldCheck size={14} strokeWidth={2.25} />
        </span>
        Paiement sécurisé · cryptage SSL
      </p>
    </form>
  );
}

export function StripePaymentModal(props: StripePaymentModalProps) {
  const { clientSecret, publishableKey, ...formProps } = props;
  const stripePromise = useMemo(
    () => getStripe(publishableKey),
    [publishableKey],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const appearance = useMemo(
    () => ({
      theme: "night" as const,
      variables: {
        colorPrimary: "#e9262a",
        colorBackground: "#121c2e",
        colorText: "#f4f6f8",
        colorTextSecondary: "rgba(244, 246, 248, 0.65)",
        colorDanger: "#e9262a",
        fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
        borderRadius: "10px",
        spacingUnit: "3px",
      },
      rules: {
        ".Input": {
          boxShadow: "none",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          backgroundColor: "#121c2e",
        },
        ".Input:focus": {
          boxShadow: "none",
          border: "1px solid rgba(233, 38, 42, 0.85)",
          outline: "none",
        },
        ".Input--invalid": {
          boxShadow: "none",
          border: "1px solid #e9262a",
        },
        ".Tab": {
          boxShadow: "none",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          backgroundColor: "transparent",
        },
        ".Tab:hover": {
          boxShadow: "none",
          backgroundColor: "rgba(255, 255, 255, 0.04)",
        },
        ".Tab--selected": {
          boxShadow: "none",
          border: "1px solid rgba(233, 38, 42, 0.7)",
          backgroundColor: "rgba(233, 38, 42, 0.12)",
        },
        ".Tab--selected:focus": {
          boxShadow: "none",
        },
        ".Block": {
          boxShadow: "none",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          backgroundColor: "transparent",
        },
        ".PickerItem": {
          boxShadow: "none",
        },
        ".CheckboxInput": {
          boxShadow: "none",
        },
        ".Dropdown": {
          boxShadow: "none",
        },
        ".Menu": {
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        },
      },
    }),
    [],
  );

  return (
    <div
      className="opt-abo-wait opt-abo-wait--stripe"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opt-abo-stripe-title"
    >
      <div className="opt-abo-wait__backdrop" aria-hidden />
      <div className="opt-abo-wait__panel opt-abo-wait__panel--stripe">
        <div className="opt-abo-stripe__sheet-bar" aria-hidden>
          <span className="opt-abo-stripe__sheet-handle" />
        </div>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance,
            locale: "fr",
          }}
        >
          <StripePayForm {...formProps} />
        </Elements>
      </div>
    </div>
  );
}
