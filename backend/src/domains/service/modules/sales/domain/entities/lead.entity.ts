import { Entity, AggregateID } from '@/shared/domain/entity.base';
import { Stage } from '../value-objects/stage.value-object';
import { LeadSource } from '../value-objects/lead-source.value-object';
import { PointOfContact } from '../value-objects/point-of-contact.value-object';
import { LeadDeviceInfo } from '../value-objects/lead-device-info.value-object';

export type LeadProps = {
  title: string | null;
  categoryId: number;
  stage: Stage | null;
  opportunity: number;
  assignedById: number | null;
  contactId: number | null;
  pointOfContact: PointOfContact | null;
  leadSource: LeadSource | null;
  deviceInfo: LeadDeviceInfo;
};

export class LeadEntity extends Entity<LeadProps> {
  protected _id: AggregateID;

  validate(): void {}
}
