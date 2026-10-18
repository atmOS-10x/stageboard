import { Field, LegalPage, LegalSection, TextLink } from "./legal"

// Copied from atmos.build/legal/imprint (atmos apps/home src/lib/company.ts): stageboard is published by atmOS GmbH.

export function Imprint() {
  return (
    <LegalPage title="Imprint" summary="Provider identification under §5 DDG and §18 MStV.">
      <LegalSection heading="Provider">
        <p className="text-fg">atmOS GmbH</p>
        <p>Aichelberger Straße 12</p>
        <p>73271 Holzmaden, Germany</p>
      </LegalSection>
      <LegalSection heading="Contact">
        <Field label="Email"><TextLink href="mailto:hello@atmos.build">hello@atmos.build</TextLink></Field>
      </LegalSection>
      <LegalSection heading="Represented by">
        <Field label="Managing directors">Daniel Teigland & Wolfgang Fink</Field>
      </LegalSection>
      <LegalSection heading="Register entry">
        <Field label="Register court">Amtsgericht Stuttgart</Field>
        <Field label="Register number">778275</Field>
      </LegalSection>
      <LegalSection heading="VAT">
        <Field label="VAT identification number under §27a UStG">DE412362389</Field>
      </LegalSection>
      <LegalSection heading="Responsible for content">
        <Field label="Responsible under §18(2) MStV">Daniel Teigland</Field>
        <p>Postal address as given above.</p>
      </LegalSection>
      <LegalSection heading="Dispute resolution">
        <p>
          The European Commission provides a platform for online dispute resolution at{" "}
          <TextLink href="https://ec.europa.eu/consumers/odr">ec.europa.eu/consumers/odr</TextLink>. We are neither obliged nor willing to take part in dispute
          resolution proceedings before a consumer arbitration board.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
