import pkg from "@remix-run/node";
const { json } = pkg;
import { authenticate } from "../../shopify.server";

export async function contactForm(request) {
  const { admin } = await authenticate.public.appProxy(request);

  const formData = await request.json();
  console.log(formData);
  try {
    const response = await admin.graphql(
      `#graphql
        mutation createMetaobject($input: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $input) {
            metaobject { id }
            userErrors { field message }
          }
        }`,
      {
        variables: {
          input: {
            type: "form_submission",
            fields: [
              { key: "firstname", value: formData?.firstName },
              { key: "lastname", value: formData?.lastName },
              { key: "email", value: formData?.email },
              { key: "phone", value: formData?.phone },
              { key: "message", value: formData?.message }
            ],
          },
        },
      },
    );

    const data = await response.json();
    console.log("data", data);
    if (data?.data?.metaobjectCreate?.userErrors?.length) {
      console.error("User errors:", data.data.metaobjectCreate.userErrors);
    }

    return data?.data?.metaobjectCreate?.metaobject || null;
  } catch (error) {
    console.error("Error adding metaobject:", error);
    return null;
  }
}

export const loader = contactForm;
export const action = contactForm;
