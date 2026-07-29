import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { publicService } from '../../../services/public.service';
import { Facility } from '../../../services/facility.service';
import { MapPin, Clock, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PricingModal } from './components/PricingModal';
import { DynamicFacilityCard } from './components/DynamicFacilityCard';

import { Loading } from '../../../components/ui/Loading';

const FacilitiesPage: React.FC = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<{ id: string; name: string } | null>(
    null
  );
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const response = await publicService.getFacilities();
        setFacilities(response.data);
      } catch (error) {
        console.error('Failed to fetch facilities', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFacilities();
  }, []);

  if (loading) {
    return <Loading text="Đang tải danh sách bãi xe..." />;
  }

  return (
    <div className="w-full h-full flex flex-col gap-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-brand mb-2 font-outfit">Khám phá Bãi đỗ xe</h1>
        <p className="text-muted-foreground">
          Chọn bãi đỗ xe gần bạn để xem chi tiết và đặt chỗ trước.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {facilities.map((facility, index) => (
          <DynamicFacilityCard
            key={facility._id}
            facility={facility}
            index={index}
            onPricingClick={(id, name) => setSelectedFacility({ id, name })}
            onBookClick={(id) => navigate(`/driver/book/${id}`)}
          />
        ))}

        {facilities.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Không tìm thấy bãi đỗ xe nào.
          </div>
        )}
      </div>

      <PricingModal
        isOpen={!!selectedFacility}
        onClose={() => setSelectedFacility(null)}
        facilityId={selectedFacility?.id || null}
        facilityName={selectedFacility?.name || ''}
      />
    </div>
  );
};

export default FacilitiesPage;
