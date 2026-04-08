export default function PolitiqueDeConfidentialite() {
  return (
    <div
      style={{
        maxWidth: "700px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "'Raleway', sans-serif",
        color: "#1A1A1A",
        lineHeight: 1.8,
      }}
    >
      <h1
        style={{
          fontSize: "24px",
          fontWeight: 700,
          marginBottom: "8px",
          color: "#1A1A1A",
        }}
      >
        Politique de confidentialite
      </h1>
      <p style={{ fontSize: "13px", color: "#A0A0A0", marginBottom: "32px" }}>
        Derniere mise a jour : 8 avril 2026
      </p>

      <Section title="1. Responsable du traitement">
        <p>
          Christophe Abbes - Photographe immobilier
          <br />
          Site : votrephotographeimmo.com
          <br />
          Email : photographiechristophe@gmail.com
          <br />
          Tel : 06 19 46 36 05
        </p>
      </Section>

      <Section title="2. Donnees collectees">
        <p>
          Dans le cadre de l&apos;outil gratuit d&apos;audit d&apos;annonces Airbnb, nous
          collectons uniquement :
        </p>
        <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
          <li>Votre prenom</li>
          <li>Votre adresse email</li>
          <li>Le titre de l&apos;annonce Airbnb analysee</li>
        </ul>
        <p>
          Aucun mot de passe, aucune donnee bancaire, aucune donnee sensible
          n&apos;est collectee.
        </p>
      </Section>

      <Section title="3. Finalite du traitement">
        <p>Vos donnees sont utilisees exclusivement pour :</p>
        <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
          <li>Vous transmettre votre rapport d&apos;audit PDF</li>
          <li>
            Vous envoyer des conseils personnalises pour ameliorer votre annonce
            (maximum 2 emails par mois)
          </li>
          <li>
            Vous proposer nos services de photographie immobiliere
          </li>
        </ul>
      </Section>

      <Section title="4. Base legale">
        <p>
          Le traitement repose sur votre <strong>consentement explicite</strong>{" "}
          (article 6.1.a du RGPD), recueilli via la case a cocher avant le
          telechargement du rapport.
        </p>
      </Section>

      <Section title="5. Destinataires des donnees">
        <p>Vos donnees sont transmises uniquement a :</p>
        <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
          <li>
            <strong>Brevo</strong> (ex-Sendinblue) : plateforme d&apos;emailing
            hebergee en France/UE, pour la gestion des contacts et l&apos;envoi
            d&apos;emails. Politique de confidentialite :{" "}
            <a
              href="https://www.brevo.com/fr/legal/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#EBBA4D" }}
            >
              brevo.com
            </a>
          </li>
        </ul>
        <p>
          Aucune donnee n&apos;est vendue, louee ou cedee a des tiers a des fins
          commerciales.
        </p>
      </Section>

      <Section title="6. Hebergement des donnees">
        <p>
          L&apos;application est hebergee sur <strong>Vercel</strong> (serveurs en
          Europe et aux Etats-Unis). Les emails sont stockes chez{" "}
          <strong>Brevo</strong> (serveurs en Union Europeenne).
        </p>
      </Section>

      <Section title="7. Duree de conservation">
        <p>
          Vos donnees sont conservees pendant une duree maximale de{" "}
          <strong>3 ans</strong> a compter de votre dernier contact avec nous. Au-dela,
          elles sont automatiquement supprimees.
        </p>
      </Section>

      <Section title="8. Vos droits">
        <p>
          Conformement au RGPD (articles 15 a 21), vous disposez des droits
          suivants :
        </p>
        <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
          <li>
            <strong>Acces</strong> : obtenir une copie de vos donnees
          </li>
          <li>
            <strong>Rectification</strong> : corriger des donnees inexactes
          </li>
          <li>
            <strong>Suppression</strong> : demander l&apos;effacement de vos donnees
          </li>
          <li>
            <strong>Opposition</strong> : vous opposer au traitement de vos
            donnees
          </li>
          <li>
            <strong>Portabilite</strong> : recevoir vos donnees dans un format
            lisible
          </li>
          <li>
            <strong>Retrait du consentement</strong> : a tout moment, sans
            justification
          </li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous a :{" "}
          <a
            href="mailto:photographiechristophe@gmail.com"
            style={{ color: "#EBBA4D" }}
          >
            photographiechristophe@gmail.com
          </a>
        </p>
        <p>
          En cas de litige, vous pouvez saisir la{" "}
          <a
            href="https://www.cnil.fr"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#EBBA4D" }}
          >
            CNIL
          </a>{" "}
          (Commission Nationale de l&apos;Informatique et des Libertes).
        </p>
      </Section>

      <Section title="9. Analyse automatisee">
        <p>
          L&apos;audit de votre annonce est genere automatiquement par
          intelligence artificielle (Google Gemini et Anthropic Claude). Les
          resultats sont fournis a titre indicatif et ne constituent pas un avis
          professionnel contractuel.
        </p>
      </Section>

      <Section title="10. Cookies">
        <p>
          Cet outil n&apos;utilise aucun cookie publicitaire ni cookie de suivi. Seuls
          des cookies techniques strictement necessaires au fonctionnement
          peuvent etre utilises.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <h2
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "#1A1A1A",
          marginBottom: "8px",
          borderBottom: "2px solid #EBBA4D",
          paddingBottom: "4px",
          display: "inline-block",
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: "14px" }}>{children}</div>
    </div>
  );
}
