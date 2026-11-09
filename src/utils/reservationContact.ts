import {isEmailHeaderAddress} from './emailAddress';

/** Existing installations remain enabled. This controls new managed-room requests,
 * never the recipient bound to a reservation that has already been issued. */
export function reservationDepartmentEnabled(config?:{roomReservationDepartmentEnabled?:boolean}):boolean{
  return config?.roomReservationDepartmentEnabled!==false;
}

/** Legacy installations keep their published contact until the shared field is saved. */
export function reservationContact(templateRecipient:unknown,sharedRecipient:unknown,centralized=false):string{
  for(const value of centralized?[sharedRecipient]:[templateRecipient,sharedRecipient]){
    if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))continue;
    const email=value.trim().toLowerCase();
    if(isEmailHeaderAddress(email))return email;
  }
  return '';
}

/** Bind historical template/config copies at use time; never modify the source snapshot. */
export function bindReservationContact<T extends Partial<import('../types/integrationStudio').IntegrationStudioSettings>>(studio:T,email:string,centralized=true):T{
  if(!email)return studio;
  return {...studio,
    ...(studio.operationalConfig?{operationalConfig:{...studio.operationalConfig,reservation:{...studio.operationalConfig.reservation,departmentEmail:email}}}:{}),
    ...(centralized&&studio.emailTemplates?{emailTemplates:studio.emailTemplates.map(template=>['email-reserva','email-resposta-departamento'].includes(String(template.id))?{...template,recipient:'<<DEPARTAMENTO_EMAIL>>'}:template)}:{})
  };
}
