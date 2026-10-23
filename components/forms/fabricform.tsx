// components/forms/FabricForm.tsx
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { fabricService } from '../../lib/api';

type FabricFormValues = {
  name: string;
};

export default function FabricForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FabricFormValues>();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit: SubmitHandler<FabricFormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      await fabricService.createFabric(data);
      setSuccess(true);
    } catch (error) {
      console.error('Hata:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Kumas Adi</label>
        <input
          {...register('name', { required: 'Bu alan zorunludur' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
      </div>

      {/* Diger form alanlari */}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
      </button>

      {success && <p className="text-green-500">Basariyla kaydedildi!</p>}
    </form>
  );
}
