import React, { useState, useEffect } from 'react';

const MemberEditModal = ({ member, mode = 'edit', sections = [], leaders = [], isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    membership_id: '',
    full_name: '',
    phone: '',
    email: '',
    gender: '',
    age_group: '',
    section_id: '',
    leader_id: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && member) {
        setFormData({
          membership_id: member.membership_id || '',
          full_name: member.full_name || '',
          phone: member.phone || '',
          email: member.email || '',
          gender: member.gender || '',
          age_group: member.age_group || '',
          section_id: member.section_id || '',
          leader_id: member.leader_id || ''
        });
      } else if (mode === 'add') {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let genId = 'MEM-';
        for (let i = 0; i < 8; i++) genId += chars.charAt(Math.floor(Math.random() * chars.length));
        setFormData({
          membership_id: genId,
          full_name: '', phone: '', email: '', gender: '', age_group: '', section_id: '', leader_id: ''
        });
      }
    }
  }, [isOpen, member, mode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === 'edit') {
        await onSave(member.id, formData);
      } else {
        await onSave(null, formData);
      }
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  if (mode === 'edit' && !member) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 border border-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-2xl font-black text-gray-900">{mode === 'edit' ? 'Edit Member' : 'Add Member'}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-800 text-3xl transition-colors outline-none focus:outline-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Membership ID {mode === 'add' && <span className="text-red-500">*</span>}</label>
              <input
                type="text"
                name="membership_id"
                value={formData.membership_id}
                onChange={handleChange}
                disabled={mode === 'edit'}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
              {mode === 'edit' && <p className="text-xs text-gray-400 mt-1">Cannot edit ID</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
          </div>

          {mode === 'add' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Section <span className="text-red-500">*</span></label>
                <select
                  name="section_id"
                  value={formData.section_id}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Select Section</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Leader <span className="text-red-500">*</span></label>
                <select
                  name="leader_id"
                  value={formData.leader_id}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Select Leader</option>
                  {leaders.filter(l => !formData.section_id || l.section_id == formData.section_id).map(l => (
                    <option key={l.id} value={l.id}>{l.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Age Group</label>
              <select
                name="age_group"
                value={formData.age_group}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Select...</option>
                <option value="Children">Children</option>
                <option value="Youth">Youth</option>
                <option value="Adult">Adult</option>
                <option value="Senior">Senior</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-700 shadow-glow transition-all"
            >
              {saving ? 'Saving...' : (mode === 'edit' ? 'Save Changes' : 'Add Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MemberEditModal;
